import { render, screen } from "@testing-library/react";
import { CirclePlus } from "lucide-react";
import { describe, expect, it } from "vitest";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";

describe("core primitives", () => {
  it("keeps its button label while loading and blocks repeat submits", () => {
    render(<Button loading>Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");
  });

  it("does not add a flex-flow sibling for the loading spinner (would resize the button, FR-016)", () => {
    const { container: idleContainer } = render(<Button>Save</Button>);
    const { container: loadingContainer } = render(<Button loading>Save</Button>);

    // The spinner must be positioned out of flow (absolute), not inserted as
    // a new flex item next to the label — otherwise the button's flow
    // content (and therefore its box width) grows when loading starts.
    const spinner = loadingContainer.querySelector("svg");
    expect(spinner).toHaveClass("absolute");

    // Both states render exactly one flow child (the label span) inside the button.
    const idleButton = idleContainer.querySelector("button");
    const loadingButton = loadingContainer.querySelector("button");
    const idleFlowChildren = Array.from(idleButton!.children).filter((el) => !el.classList.contains("absolute"));
    const loadingFlowChildren = Array.from(loadingButton!.children).filter((el) => !el.classList.contains("absolute"));
    expect(idleFlowChildren).toHaveLength(1);
    expect(loadingFlowChildren).toHaveLength(1);
  });

  it("hides the loading label with opacity, not visibility, so it stays in the accessible name", () => {
    render(<Button loading>Save</Button>);
    const label = screen.getByText("Save");
    expect(label.className).not.toMatch(/\binvisible\b/);
    expect(label.className).toMatch(/\bopacity-0\b/);
  });

  it("requires an accessible icon-button name", () => {
    render(<IconButton label="Add record"><CirclePlus /></IconButton>);
    expect(screen.getByRole("button", { name: "Add record" })).toBeVisible();
  });

  it("exposes non-color-only alert content", () => {
    render(<Alert variant="error" title="Could not save">Check the fields and try again.</Alert>);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not save");
  });
});
