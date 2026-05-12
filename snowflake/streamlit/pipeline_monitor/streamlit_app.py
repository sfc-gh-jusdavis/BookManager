"""BKMNG Pipeline Monitor — Streamlit in Snowflake app.

Tabs:
  1. Health Check  — current PASS/WARN/FAIL state from SP_BKMNG_PIPELINE_HEALTH_CHECK
  2. Freshness SLA — per-table SLA burn-down bar chart
  3. Task DAG      — graphviz dependency graph from SP_BKMNG_PIPELINE_INVENTORY
  4. Cost / Credits per Task — last 30d credits via SNOWFLAKE.ACCOUNT_USAGE
  5. Run History  — last 7d task runs from TEMP.INFORMATION_SCHEMA.TASK_HISTORY
"""

import streamlit as st
import pandas as pd
import altair as alt
from snowflake.snowpark.context import get_active_session

st.set_page_config(page_title="BKMNG Pipeline Monitor", layout="wide")
session = get_active_session()


@st.cache_data(ttl=300, show_spinner=False)
def health_check() -> pd.DataFrame:
    rows = session.sql("CALL TEMP.JUSDAVIS.SP_BKMNG_PIPELINE_HEALTH_CHECK()").to_pandas()
    return rows


@st.cache_data(ttl=300, show_spinner=False)
def inventory() -> pd.DataFrame:
    rows = session.sql("CALL TEMP.JUSDAVIS.SP_BKMNG_PIPELINE_INVENTORY()").to_pandas()
    return rows


@st.cache_data(ttl=300, show_spinner=False)
def task_run_history(days: int = 7) -> pd.DataFrame:
    sql = f"""
        SELECT
          NAME,
          STATE,
          SCHEDULED_TIME,
          QUERY_START_TIME,
          DATEDIFF('second', QUERY_START_TIME, COMPLETED_TIME) AS DURATION_S,
          ERROR_CODE,
          LEFT(COALESCE(ERROR_MESSAGE,''), 300) AS ERROR_MESSAGE,
          QUERY_ID
        FROM TABLE(TEMP.INFORMATION_SCHEMA.TASK_HISTORY(
          SCHEDULED_TIME_RANGE_START => DATEADD('day', -{days}, CURRENT_TIMESTAMP()),
          RESULT_LIMIT => 1000))
        WHERE NAME ILIKE 'TASK_%BKMNG%' OR NAME ILIKE 'TASK_COMPUTE%' OR NAME ILIKE 'TASK_PARSE%' OR NAME ILIKE 'TASK_CHECK%' OR NAME ILIKE 'TASK_BACKFILL%'
        ORDER BY SCHEDULED_TIME DESC
    """
    return session.sql(sql).to_pandas()


@st.cache_data(ttl=900, show_spinner=False)
def credits_per_task(days: int = 30) -> pd.DataFrame:
    """Join ACCOUNT_USAGE.TASK_HISTORY to QUERY_HISTORY for credits.
    Note: ACCOUNT_USAGE has 45min-3hr latency."""
    sql = f"""
        SELECT
          th.NAME AS TASK_NAME,
          DATE_TRUNC('day', th.SCHEDULED_TIME)::DATE AS DAY,
          COUNT(*) AS RUNS,
          SUM(COALESCE(qh.CREDITS_USED_CLOUD_SERVICES, 0)) AS CREDITS_CLOUD,
          SUM(COALESCE(qh.TOTAL_ELAPSED_TIME, 0)) / 1000.0 AS TOTAL_SECONDS
        FROM SNOWFLAKE.ACCOUNT_USAGE.TASK_HISTORY th
        LEFT JOIN SNOWFLAKE.ACCOUNT_USAGE.QUERY_HISTORY qh
          ON th.QUERY_ID = qh.QUERY_ID
        WHERE th.DATABASE_NAME = 'TEMP'
          AND th.SCHEMA_NAME = 'JUSDAVIS'
          AND th.SCHEDULED_TIME >= DATEADD('day', -{days}, CURRENT_TIMESTAMP())
          AND th.STATE = 'SUCCEEDED'
        GROUP BY 1, 2
        ORDER BY 2 DESC, 1
    """
    return session.sql(sql).to_pandas()


def status_color(s: str) -> str:
    return {"PASS": "background-color:#103a23;color:#9be3a8",
            "WARN": "background-color:#3a3318;color:#f5e08c",
            "FAIL": "background-color:#3a1818;color:#f5a8a8"}.get(s, "")


# -----------------------------
# UI
# -----------------------------
st.title("BKMNG Pipeline Monitor")

col_a, col_b = st.columns([4, 1])
with col_b:
    if st.button("Refresh"):
        st.cache_data.clear()
        st.rerun()
with col_a:
    st.caption("Live state of the BookManager data pipeline. Cached 5 min. ACCOUNT_USAGE views have ~45m–3h latency.")

tab_h, tab_sla, tab_dag, tab_cost, tab_runs = st.tabs(
    ["Health", "Freshness SLA", "Task DAG", "Cost / Credits", "Run History"]
)

# -----------------------------
# Tab 1 — Health
# -----------------------------
with tab_h:
    df_h = health_check()
    counts = df_h["STATUS"].value_counts().to_dict()
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Total tables", len(df_h))
    c2.metric("PASS", counts.get("PASS", 0))
    c3.metric("WARN", counts.get("WARN", 0))
    c4.metric("FAIL", counts.get("FAIL", 0))

    styled = df_h.style.applymap(status_color, subset=["STATUS"])
    st.dataframe(styled, use_container_width=True, hide_index=True)

# -----------------------------
# Tab 2 — Freshness SLA
# -----------------------------
with tab_sla:
    df_h = health_check().copy()
    df_h["AGE_HOURS"] = pd.to_numeric(df_h["AGE_HOURS"], errors="coerce")
    df_h["MAX_AGE_HOURS"] = pd.to_numeric(df_h["MAX_AGE_HOURS"], errors="coerce")
    df_h["SLA_PCT"] = (df_h["AGE_HOURS"] / df_h["MAX_AGE_HOURS"]).round(2) * 100
    df_h = df_h.sort_values("SLA_PCT", ascending=False)

    chart = (
        alt.Chart(df_h)
        .mark_bar()
        .encode(
            x=alt.X("SLA_PCT:Q", title="% of SLA budget used"),
            y=alt.Y("TABLE_NAME:N", sort="-x", title=None),
            color=alt.condition(
                "datum.SLA_PCT > 100",
                alt.value("#e85a5a"),
                alt.condition("datum.SLA_PCT > 75", alt.value("#f5c542"), alt.value("#5ab85a")),
            ),
            tooltip=["TABLE_NAME", "AGE_HOURS", "MAX_AGE_HOURS", "SLA_PCT", "STATUS"],
        )
        .properties(height=max(400, 22 * len(df_h)))
    )
    rule = alt.Chart(pd.DataFrame({"x": [100]})).mark_rule(color="red", strokeDash=[4, 4]).encode(x="x:Q")
    st.altair_chart(chart + rule, use_container_width=True)

    st.dataframe(df_h[["TABLE_NAME", "AGE_HOURS", "MAX_AGE_HOURS", "SLA_PCT", "STATUS"]],
                 hide_index=True, use_container_width=True)

# -----------------------------
# Tab 3 — Task DAG
# -----------------------------
with tab_dag:
    df_i = inventory()
    lines = ["digraph G {",
             '  rankdir=LR;',
             '  node [shape=box, style="rounded,filled", fontname=Helvetica, fontsize=10];',
             '  bgcolor="transparent";']
    for _, r in df_i.iterrows():
        name = r["TASK_NAME"]
        state = (r["STATE"] or "").lower()
        suspended_reason = r["LAST_SUSPENDED_REASON"] or ""
        if state == "started":
            fill = "#1d4f2c"; fc = "#cdeed5"
        elif "ERROR" in suspended_reason:
            fill = "#5a1818"; fc = "#fbcaca"
        else:
            fill = "#3a3318"; fc = "#f5e08c"
        sched = (r["SCHEDULE"] or "").replace("USING CRON ", "").replace(" UTC", "")
        label = f'{name}\\n{sched}'
        lines.append(f'  "{name}" [label="{label}", fillcolor="{fill}", fontcolor="{fc}"];')
        preds_raw = r["PREDECESSORS"] or ""
        if preds_raw and preds_raw != "[]":
            for p in preds_raw.replace('"', '').replace('[', '').replace(']', '').split(','):
                p = p.strip().split('.')[-1]
                if p:
                    lines.append(f'  "{p}" -> "{name}";')
    lines.append("}")
    st.graphviz_chart("\n".join(lines))

# -----------------------------
# Tab 4 — Cost / Credits
# -----------------------------
with tab_cost:
    days = st.slider("Lookback (days)", 7, 60, 30, key="cost_days")
    df_c = credits_per_task(days)
    if df_c.empty:
        st.info("No data yet. ACCOUNT_USAGE.TASK_HISTORY has 45m–3h latency.")
    else:
        df_c["TOTAL_MINUTES"] = (df_c["TOTAL_SECONDS"] / 60).round(2)
        col1, col2, col3 = st.columns(3)
        col1.metric("Tasks tracked", df_c["TASK_NAME"].nunique())
        col2.metric("Total runs", int(df_c["RUNS"].sum()))
        col3.metric("Total minutes", f"{df_c['TOTAL_MINUTES'].sum():.1f}")

        st.subheader("Compute time by task per day (minutes)")
        chart = (
            alt.Chart(df_c)
            .mark_bar()
            .encode(
                x=alt.X("DAY:T"),
                y=alt.Y("TOTAL_MINUTES:Q", title="Compute minutes (sum)"),
                color=alt.Color("TASK_NAME:N", legend=None),
                tooltip=["TASK_NAME", "DAY", "RUNS", "TOTAL_MINUTES", "CREDITS_CLOUD"],
            )
            .properties(height=350)
        )
        st.altair_chart(chart, use_container_width=True)

        st.subheader("Top tasks by total compute time")
        agg = (df_c.groupby("TASK_NAME", as_index=False)
               .agg(RUNS=("RUNS", "sum"), TOTAL_MINUTES=("TOTAL_MINUTES", "sum"),
                    CREDITS_CLOUD=("CREDITS_CLOUD", "sum"))
               .sort_values("TOTAL_MINUTES", ascending=False))
        st.dataframe(agg, hide_index=True, use_container_width=True)

# -----------------------------
# Tab 5 — Run History
# -----------------------------
with tab_runs:
    days = st.slider("Lookback (days)", 1, 7, 7, key="run_days")
    df_r = task_run_history(days)
    if df_r.empty:
        st.info("No task runs found in the lookback window.")
    else:
        c1, c2, c3 = st.columns(3)
        c1.metric("Runs", len(df_r))
        c2.metric("SUCCEEDED", int((df_r["STATE"] == "SUCCEEDED").sum()))
        c3.metric("FAILED", int((df_r["STATE"] == "FAILED").sum()))

        st.subheader("Heatmap: runs by task & state")
        heat = (df_r.groupby(["NAME", "STATE"]).size().reset_index(name="N"))
        chart = (alt.Chart(heat).mark_rect()
                 .encode(x=alt.X("STATE:N"), y=alt.Y("NAME:N", sort="-x"),
                         color=alt.Color("N:Q"),
                         tooltip=["NAME", "STATE", "N"])
                 .properties(height=max(400, 22 * df_r["NAME"].nunique())))
        st.altair_chart(chart, use_container_width=True)

        st.subheader("Recent runs")
        st.dataframe(df_r, hide_index=True, use_container_width=True)
