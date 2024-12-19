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

  const fetchGames = async (username: string): Promise<Game[]> => {
    const endpoint = `https://boardgamegeek.com/xmlapi2/collection?username=${username}&own=1`;

    const delay = (ms: number): Promise<void> =>
      new Promise((resolve) => setTimeout(resolve, ms));

    while (true) {
      const response = await fetch(endpoint);

      const MAX_RETRIES = 5;

      let retryCount = 0;
      while (retryCount < MAX_RETRIES) {
        if (response.status === 202) {
          retryCount++;
          console.log(`Request queued. Retrying (${retryCount}/${MAX_RETRIES})...`);
          await delay(2000);
        } else {
          break;
        }
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

      const bestPlayerCounts = await fetchBestPlayerCounts(games.map((g) => g.id).join(','));

      games.forEach((game) => {
        const fetchedGame = bestPlayerCounts.find((b) => b.id === game.id);
        if (fetchedGame !== undefined) {
          if (fetchedGame.bestWith !== undefined) { // TODO check why sometimes there is undefined 
            game.bestWith = fetchedGame.bestWith;
          }
          if (fetchedGame.recommendedWith !== undefined) {
            game.recommendedWith = fetchedGame.recommendedWith;
          }
        }
      });

      return games;
    }
  };

  const fetchBestPlayerCounts = async (gameIds: string): Promise<PlayersCountDto[]> => {
    const endpoint = `https://bgg-proxy.fly.dev/boardgames/${gameIds}`;
    const response = await fetch(endpoint);
    if (!response.ok) {
      throw new Error(`Failed to fetch player counts. Try again later.`);
    }

    return await response.json();
  };

  const handleContinue = async (): Promise<void> => {
    setGames([]);
    setIsLoading(true);
    setError(null);

    try {
      const gamesList = await fetchGames(username);
      setGames(gamesList);
    } catch (err) {
      setError((err as Error).message);
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

        <Box sx={{ width: 500, marginLeft: 'auto', marginRight: 'auto' }}>
          <Slider
            value={playersRange}
            onChange={handlePlayersRangeChange}
            min={1}
            max={8}
            marks={playerMarks}
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
                    <p className="text-sm text-gray-500">
                      Best: {game.bestWith.join(', ')} | Recommended: {game.recommendedWith.join(', ')}
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

