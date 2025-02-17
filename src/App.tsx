import { useState } from "react";
import "./App.css";
import { Slider, Box } from "@mui/material";

interface Game {
  id: string;
  name: string;
  bestWith: number[];
  recommendedWith: number[];
}

interface PlayersCountDto {
  id: string;
  bestWith: number[];
  recommendedWith: number[];
}

const playerMarks = [
  {
    value: 1,
    label: '1'
  },
  {
    value: 2,
    label: '2'
  },
  {
    value: 3,
    label: '3'
  },
  {
    value: 4,
    label: '4'
  },
  {
    value: 5,
    label: '5'
  },
  {
    value: 6,
    label: '6'
  },
  {
    value: 7,
    label: '7'
  },
  {
    value: 8,
    label: '8'
  },
]

const App: React.FC = () => {
  const [username, setUsername] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [games, setGames] = useState<Game[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [playersRange, setPlayersRange] = useState([2, 5]);
  const [bestOnly, setBestOnly] = useState(true);

  const fetchGames = async (username: string) => {
    const ownedGamesEndpoint = `https://boardgamegeek.com/xmlapi2/collection?username=${username}&own=1`;

    const delay = (ms: number): Promise<void> =>
      new Promise((resolve) => setTimeout(resolve, ms));

      let response = await fetch(ownedGamesEndpoint);

      const MAX_RETRIES = 10;

      let retryCount = 0;
      while (retryCount < MAX_RETRIES) {
        if (response.status === 202) {
          retryCount++;
          console.log(`Request queued. Retrying (${retryCount}/${MAX_RETRIES})...`);
          await delay(2000);
        } else {
          break;
        }
        response = await fetch(ownedGamesEndpoint);
      }

      if (retryCount === MAX_RETRIES) {
        throw new Error("Cannot read collection from BGG. Try again later.");
      }

      // Parse the XML response
      const text = await response.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, "application/xml");

      // Check for XML errors
      const errorMessage = xml.querySelector("message")?.textContent;
      if (errorMessage) {
        throw new Error(errorMessage);
      }

      const gameNodes = xml.querySelectorAll("item");
      if (gameNodes.length == 0) {
        setError(`Empty collection`);
        setGames([]);
      }

      const games: Game[] = Array.from(gameNodes).map((node) => {
        const id = node.getAttribute("objectid") || "unknown";
        const name =
          node.querySelector("name")?.textContent || "Unknown Game";

        return {
          id: id,
          name: name,
          bestWith: [],
          recommendedWith: []
        };
      });

      setGames(getUniqueObjects(games, 'id'));
      await fetchBestPlayerCounts(games.map((g) => g.id));
  };

  const fetchBestPlayerCounts = async (gameIds: string[]) => {
    try {
      // local development: const endpoint = `http://localhost:8080/boardgames/stream`;
      const endpoint = `https://bgg-proxy.fly.dev/boardgames/stream`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ids: gameIds }),
      });
      if (!response.ok || !response.body) {
        throw new Error(`Failed to fetch player counts. Try again later.`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');

        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i];
          if (line.trim()) {
            const data: PlayersCountDto = JSON.parse(line);

            setGames((prevGames) =>
              prevGames.map((game) =>
                game.id === data.id
                  ? {
                      ...game,
                      bestWith: data.bestWith ?? game.bestWith,
                      recommendedWith: data.recommendedWith ?? game.recommendedWith,
                    }
                  : game
              )
            );
          }
        }

        // Keep the last line as a partial buffer for next iteration
        buffer = lines[lines.length - 1];
      }
    } catch (err) {
      console.error('Streaming error:', err);
      setError('Failed to stream updates. Please retry.');
    }
  };

  const handleContinue = async (): Promise<void> => {
    setGames([]);
    setIsLoading(true);
    setError(null);

    try {
      await fetchGames(username);
    } catch (err) {
      const error = err as Error;
      if (error.message.indexOf("NetworkError") > -1) {
        setError(`Wrong username?`);
      } else {
        setError(error.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayersRangeChange = (_: Event, newValue: number | number[]) => {
    setPlayersRange(newValue as number[]);
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUsername(e.target.value);
  };

  const getUniqueObjects = (array: Game[], key: keyof Game): Game[] => {
    const seen = new Set();
    return array.filter(item => {
      const value = item[key];
      if (seen.has(value)) {
        return false;
      } else {
        seen.add(value);
        return true;
      }
    });
  }

  const filteredGames = games
    .filter(game => {
      if (!bestOnly) {
        return game.bestWith.some(n => n >= playersRange[0] && n <= playersRange[1]) ||
          game.recommendedWith.some(n => n >= playersRange[0] && n <= playersRange[1]);
      } else {
        return game.bestWith.some(n => n >= playersRange[0] && n <= playersRange[1]);
      }
    });

  const toggleBestOnly = () => {
    setBestOnly(!bestOnly);
  };

  const shortGameName = (game: Game) => game.name.length > 30 ? game.name.substring(0, 30) + "..." : game.name

  return (
    <div className="container">
      <main>
        <h3>Find a good game for a selected number of players</h3>

        <label htmlFor="username">
          <input
            type="text"
            id="username"
            placeholder="Enter BGG username and press 'Continue'"
            value={username}
            onChange={handleUsernameChange}
          />
        </label>

        <button
          type="submit"
          disabled={!username || isLoading}
          onClick={handleContinue}
        >
          {isLoading ? "Loading..." : "Continue"}
        </button>

        {error && <p className="text-red-500 text-center mt-4">{error}</p>}

        <Box sx={{ width: '90%', maxWidth: 500, marginLeft: 'auto', marginRight: 'auto' }}>
          <Slider
            value={playersRange}
            onChange={handlePlayersRangeChange}
            min={1}
            max={8}
            marks={playerMarks}
            sx={{
              '& .MuiSlider-markLabel': {
                color: 'gray',
              },
            }}
          />
        </Box>

        <label>
          <input type="checkbox" name="best-only" defaultChecked onClick={toggleBestOnly}/>
          Use 'Best' only (ignore 'Recommended')
        </label>

        <div className="mt-6">
          <ul className="space-y-2">
            {filteredGames.map((game) => (
              <li key={game.id} className="flex flex-col space-y-2">
                <h3 className="font-bold"><a href={`https://boardgamegeek.com/boardgame/${game.id}`} target="_blank">{shortGameName(game)}</a></h3>
                {game.bestWith.length + game.recommendedWith.length > 0 ? (
                  <div>
                    <p className="text-sm text-gray-500 text-nowrap">
                      {`Best: ${game.bestWith.join(', ')} | Recommended: ${game.recommendedWith.join(', ')}`}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">
                    Best player count data unavailable
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
};

export default App;

