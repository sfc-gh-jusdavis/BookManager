import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

describe("React Testing Library smoke", () => {
  it("renders simple JSX into jsdom", () => {
    render(<div data-testid="hello">Hello, BookManager</div>);
    expect(screen.getByTestId("hello")).toHaveTextContent("Hello, BookManager");
  });

  it("supports basic component composition", () => {
    function Greeting({ name }: { name: string }) {
      return <p data-testid="greeting">Hi {name}</p>;
    }
    render(<Greeting name="Tester" />);
    expect(screen.getByTestId("greeting")).toHaveTextContent("Hi Tester");
  });
});
