import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import '@testing-library/jest-dom';
import App from "./App";

describe("App component", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("renders the app with a username input and a submit button", () => {
    render(<App />);
    expect(screen.getByPlaceholderText("Enter BGG username and press 'Continue'")).toBeInTheDocument();
    expect(screen.getByText("Continue")).toBeInTheDocument();
  });

  it("disables the button when username is empty", () => {
    render(<App />);
    const button = screen.getByText("Continue");
    expect(button).toBeDisabled();
  });

  it("enables the button when a username is entered", () => {
    render(<App />);
    const input = screen.getByPlaceholderText("Enter BGG username and press 'Continue'");
    fireEvent.change(input, { target: { value: "testuser" } });
    const button = screen.getByText("Continue");
    expect(button).not.toBeDisabled();
  });

  it("shows loading state and fetches games when button is clicked", async () => {
    const mockCollection = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
        <items>
            <item objecttype="thing" objectid="111775" subtype="boardgame" collid="21812718">
                <name>Test Game</name>
                <yearpublished>2011</yearpublished>
            </item>
        </items>`;

    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        text: () => Promise.resolve(mockCollection),
      })
    ).mockImplementationOnce((url, options) => {
      expect(url).toBe('https://bgg-proxy.fly.dev/boardgames/stream');
      expect(options.method).toBe('POST');
      expect(options.headers).toEqual({
        'Content-Type': 'application/json',
      });
      expect(JSON.parse(options.body)).toEqual({ ids: ["111775"] });

      // fix this test - it doesn't work with streaming
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve([{ "id": "111775", "bestWith": [3, 4], "recommendedWith": [3, 4, 5] }]),
      });
    });

    render(<App />);

    const input = screen.getByPlaceholderText("Enter BGG username and press 'Continue'");
    fireEvent.change(input, { target: { value: "testuser" } });

    const button = screen.getByText("Continue");
    fireEvent.click(button);

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Test Game")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText(`Best: 3, 4 | Recommended: 3, 4, 5`)).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("displays an error message if fetch fails", async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.reject(new Error("Network Error"))
    );

    render(<App />);

    const input = screen.getByPlaceholderText("Enter BGG username and press 'Continue'");
    fireEvent.change(input, { target: { value: "testuser" } });

    const button = screen.getByText("Continue");
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Network Error")).toBeInTheDocument();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
