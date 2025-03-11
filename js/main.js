// Game state object
const gameState = {
  player: {
    health: 100,
    inventory: []
  },
  world: {
    currentLocation: "",
    theme: ""
  },
  conversation: [],
  apiKey: "",
  selectedModel: "",
  gameStarted: false,
  waitingForApiKey: false,
  waitingForThemeSelection: false,
  waitingForModelSelection: false,
  options: [],
  commandHistory: [],
  commandHistoryIndex: -1,
  isProcessing: false,
  isTyping: false // New flag to track text animation status
};

// Available themes and models
const availableThemes = [
  // Fantasy and magical settings
  { id: "1", theme: "Fantasy World" },
  { id: "2", theme: "Enchanted Fairy Tale" },
  { id: "3", theme: "Magical School" },
  { id: "4", theme: "Celestial Realms" },
  { id: "5", theme: "Mythological Odyssey" },

  // Historical/period settings
  { id: "6", theme: "Steampunk Victorian" },
  { id: "7", theme: "High Seas Piracy" },
  { id: "8", theme: "Wild West Frontier" },
  { id: "9", theme: "Noir Detective" },

  // Futuristic and sci-fi settings
  { id: "10", theme: "Space Explorer" },
  { id: "11", theme: "Cyberpunk City" },
  { id: "12", theme: "Alien Planet" },
  { id: "13", theme: "Time Travel Paradox" },

  // Dark and horror themes
  { id: "14", theme: "Haunted Mansion" },
  { id: "15", theme: "Lovecraftian Horror" },
  { id: "16", theme: "Zombie Outbreak" },

  // Dystopian and post-apocalyptic
  { id: "17", theme: "Post-Apocalyptic Survival" },
  { id: "18", theme: "Dystopian Society" },

  // Exploration and adventure
  { id: "19", theme: "Jungle Expedition" },
  { id: "20", theme: "Underwater Abyss" },
  { id: "21", theme: "Underground Kingdom" },

  // Superhero
  { id: "22", theme: "Superhero Universe" }
];

const availableModels = [
  { id: "1", model: "google/gemini-2.0-flash-thinking-exp:free" },
  { id: "2", model: "google/gemini-2.0-flash-thinking-exp-1219:free" }
];

// DOM elements
const terminalOutput = document.getElementById("terminal-output");
const gameNarrative = document.getElementById("game-narrative");
const commandInput = document.getElementById("command-input");
const loadingSpinner = document.getElementById("loading-spinner");
const a11yStatus = document.getElementById("a11y-status");

// Rate limiting
const rateLimit = {
  options: 0,
  maxOptions: 20,
  timestamp: Date.now(),
  daily: 0,
  maxDaily: 200,
  dailyReset: new Date().setHours(0, 0, 0, 0) + 86400000 // Next midnight
};

// Initialize the game
document.addEventListener("DOMContentLoaded", () => {
  // Focus input on page load
  commandInput.focus();

  // Set up event listeners - only keep the essential ones
  setupEventListeners();

  // Reset daily rate limit at midnight
  const resetTime = new Date().setHours(0, 0, 0, 0) + 86400000;
  const timeUntilReset = resetTime - Date.now();
  setTimeout(() => {
    rateLimit.daily = 0;
    rateLimit.dailyReset = new Date().setHours(0, 0, 0, 0) + 86400000;
  }, timeUntilReset);

  // Try to restore API key from localStorage
  const savedApiKey = localStorage.getItem("apiKey");
  if (savedApiKey) {
    gameState.apiKey = savedApiKey;
    typeText("A familiar face at last, welcome again adventurer.\n\n");
  } else {
    typeText("Welcome wonderer, the adventure awaits you.\n\n");
  }
});

// Setup all event listeners - minimized to just the essential terminal functionality
function setupEventListeners() {
  // Command input events - only keep Enter for commands and Arrow keys for history
  commandInput.addEventListener("keydown", handleCommandInputKeydown);

  // Keep the input focused
  document.addEventListener("click", focusCommandInput);
}

// Handle keyboard input events - simplified to only handle Enter, Up, and Down
function handleCommandInputKeydown(event) {
  // If text is being typed, ignore input
  if (gameState.isTyping) {
    event.preventDefault();
    return;
  }

  // Handle Enter key to process command
  if (event.key === "Enter") {
    const command = commandInput.value.trim();
    if (command) {
      // Add to command history
      if (
        gameState.commandHistory.length === 0 ||
        gameState.commandHistory[gameState.commandHistory.length - 1] !==
          command
      ) {
        gameState.commandHistory.push(command);
      }
      gameState.commandHistoryIndex = gameState.commandHistory.length;

      // Clear input and process command
      commandInput.value = "";
      processCommand(command);
    }
    event.preventDefault();
    return;
  }

  // Handle Up Arrow for command history
  if (event.key === "ArrowUp") {
    if (gameState.commandHistory.length > 0) {
      if (gameState.commandHistoryIndex > 0) {
        gameState.commandHistoryIndex--;
      }
      commandInput.value =
        gameState.commandHistory[gameState.commandHistoryIndex];

      // Move cursor to end of input
      setTimeout(() => {
        commandInput.selectionStart = commandInput.selectionEnd =
          commandInput.value.length;
      }, 0);
    }
    event.preventDefault();
    return;
  }

  // Handle Down Arrow for command history
  if (event.key === "ArrowDown") {
    if (gameState.commandHistoryIndex < gameState.commandHistory.length - 1) {
      gameState.commandHistoryIndex++;
      commandInput.value =
        gameState.commandHistory[gameState.commandHistoryIndex];
    } else {
      // Clear input if at the end of history
      gameState.commandHistoryIndex = gameState.commandHistory.length;
      commandInput.value = "";
    }
    event.preventDefault();
    return;
  }
}

// Focus command input - now checks if typing is in progress
function focusCommandInput() {
  // Only focus if the target is not another input or interactive element
  // and we're not in the middle of typing text
  if (
    !gameState.isTyping &&
    document.activeElement.tagName !== "INPUT" &&
    document.activeElement.tagName !== "BUTTON" &&
    document.activeElement.tagName !== "A"
  ) {
    commandInput.focus();
  }
}

// Announce messages to screen readers - keep for accessibility
function announceToScreenReader(message) {
  a11yStatus.textContent = message;

  // Clear after a delay to ensure it's read
  setTimeout(() => {
    a11yStatus.textContent = "";
  }, 3000);
}

// Process user commands
async function processCommand(command) {
  // Show command as user input with appropriate styling
  const userCommandElement = document.createElement("div");
  userCommandElement.className = "user-command";
  userCommandElement.textContent = `> ${command}`;
  gameNarrative.appendChild(userCommandElement);

  // Announce command to screen readers
  announceToScreenReader(`Command entered: ${command}`);

  // Check rate limits
  const now = Date.now();
  // Reset options counter if a minute has passed
  if (now - rateLimit.timestamp > 60000) {
    rateLimit.options = 0;
    rateLimit.timestamp = now;
  }

  // Reset daily counter if day has changed
  if (now > rateLimit.dailyReset) {
    rateLimit.daily = 0;
    rateLimit.dailyReset = new Date().setHours(0, 0, 0, 0) + 86400000;
  }

  // Handle disconnect command
  if (command.toLowerCase() === "disconnect") {
    localStorage.removeItem("apiKey");
    gameState.apiKey = "";
    resetGameState();
    typeText("API key disconnected. You can now use a different API key.\n\n");
    return;
  }

  // Handle different command states
  if (gameState.waitingForApiKey) {
    handleApiKeyInput(command);
    return;
  }

  if (gameState.waitingForModelSelection) {
    handleModelSelection(command);
    return;
  }

  if (gameState.waitingForThemeSelection) {
    handleThemeSelection(command);
    return;
  }

  // Handle game options if game is started
  if (gameState.gameStarted && /^[1-3]$/.test(command)) {
    // Check rate limits
    if (rateLimit.options >= rateLimit.maxOptions) {
      typeText(
        "Rate limit reached: Maximum 20 options per minute. Please wait before making another choice.\n\n"
      );
      return;
    }

    if (rateLimit.daily >= rateLimit.maxDaily) {
      typeText(
        "Daily rate limit reached: Maximum 200 options per day. Please try again tomorrow.\n\n"
      );
      return;
    }

    const optionId = parseInt(command);
    const selectedOption = gameState.options.find((opt) => opt.id === optionId);

    if (selectedOption) {
      rateLimit.options++;
      rateLimit.daily++;
      handleGameChoice(selectedOption.text);
    } else {
      typeText("Invalid choice. Please enter 1, 2, or 3.\n\n");
    }
    return;
  }

  // Process general commands
  switch (command.toLowerCase()) {
    case "wake up":
      startGame();
      break;
    case "help":
      showHelp();
      break;
    case "save":
      saveGame();
      break;
    case "load":
      loadGame();
      break;
    default:
      if (gameState.gameStarted) {
        typeText("Invalid choice. Please enter 1, 2, or 3.\n\n");
      } else {
        typeText(
          `Command not recognized. Type 'wake up' to initialize or 'help' for assistance.\n\n`
        );
      }
  }
}

// Show help information - simplified to remove keyboard shortcuts and GUI references
function showHelp() {
  const helpText = `
Terminal RPG Help:
\n------------------------------------------------------------\n
Navigate your adventure with these commands:

  'wake up'   : Start a new game. You'll be prompted for your
                OpenRouter API key and to choose a theme.

  '1', '2', '3' : Respond to story prompts by typing the number
                corresponding to your desired option.

**Save & Load Game Progress:**

  - **Saving Your Game:**
    Type 'save' to download your progress.

  - **Loading a Saved Game:**
    Type 'load' and select your saved file.

**API Key Management:**

  - 'disconnect' : Remove saved API key if you want to use a different one.

Enjoy your AI-driven text adventure!
\n------------------------------------------------------------\n
`;
  typeText(helpText);

  // Announce for screen readers
  announceToScreenReader("Help information displayed");
}

// Start the game
function startGame() {
  resetGameState();

  // Check if we already have an API key stored
  if (gameState.apiKey) {
    gameState.waitingForModelSelection = true;
    typeText(
      "\nUsing saved API key.\n\nPlease select an LLM model by typing its number:\n",
      () => {
        displayModelOptions();
      }
    );

    // Announce for screen readers
    announceToScreenReader("Using saved API key. Please select a model");
  } else {
    gameState.waitingForApiKey = true;
    typeText(
      "\nWelcome to Terminal RPG!\n\nPlease enter your OpenRouter API key (starts with sk-or-...):\n"
    );

    // Announce for screen readers
    announceToScreenReader(
      "Game initialization started. Please enter your API key"
    );
  }
}

// Reset game state
function resetGameState() {
  gameState.player = {
    health: 100,
    inventory: []
  };
  gameState.world = {
    currentLocation: "",
    theme: ""
  };
  gameState.conversation = [];
  gameState.gameStarted = false;
  gameState.waitingForApiKey = false;
  gameState.waitingForThemeSelection = false;
  gameState.waitingForModelSelection = false;
  gameState.options = [];
  gameState.isTyping = false; // Reset typing flag
  // Don't reset command history
}

// Handle API key input
function handleApiKeyInput(key) {
  if (key.startsWith("sk-or-")) {
    gameState.apiKey = key;
    localStorage.setItem("apiKey", key);
    gameState.waitingForApiKey = false;
    gameState.waitingForModelSelection = true;

    // Show loading animation
    showLoadingSpinner("Validating API key...");

    // Announce for screen readers
    announceToScreenReader("API key entered. Validating...");

    // Display masked API key
    const maskedKey = "*".repeat(key.length);
    typeText(`API key entered: ${maskedKey}`, () => {});

    setTimeout(() => {
      hideLoadingSpinner();
      typeText(
        "API key validated!\n\nPlease select an LLM model by typing its number:\n",
        () => {
          displayModelOptions();
        }
      );

      // Announce for screen readers
      announceToScreenReader("API key validated. Please select a model");
    }, 1500);
  } else {
    typeText(
      "Invalid API key format. Please enter a valid OpenRouter API key (starts with sk-or-...):\n"
    );

    // Announce for screen readers
    announceToScreenReader("Invalid API key format. Please try again");
  }
}

// Display model selection options
function displayModelOptions() {
  let modelText = "\n";
  availableModels.forEach((model) => {
    modelText += `${model.id}. ${model.model.split("/")[1]}\n`;
  });
  typeText(modelText + "\n");
}

// Handle model selection
function handleModelSelection(selection) {
  const modelOption = availableModels.find(
    (m) => m.id === selection || m.model.includes(selection)
  );

  if (modelOption) {
    gameState.selectedModel = modelOption.model;
    gameState.waitingForModelSelection = false;

    // If this is a loaded game that already has a theme, skip theme selection
    if (gameState.world.theme) {
      gameState.gameStarted = true;

      // Announce for screen readers
      announceToScreenReader(
        `Model selected: ${
          modelOption.model.split("/")[1]
        }. Resuming saved game...`
      );

      typeText(
        `\nModel selected: ${
          modelOption.model.split("/")[1]
        }\n\nResuming saved game...`,
        () => {
          resumeLoadedGame();
        }
      );
    } else {
      gameState.waitingForThemeSelection = true;

      typeText(
        `\nModel selected: ${
          modelOption.model.split("/")[1]
        }\n\nPlease select a theme by typing its number:\n`,
        () => {
          displayThemeOptions();
        }
      );

      // Announce for screen readers
      announceToScreenReader(
        `Model selected: ${
          modelOption.model.split("/")[1]
        }. Please select a theme`
      );
    }
  } else {
    typeText(
      "Invalid model selection. Please select a valid model number:\n\n"
    );
    displayModelOptions();

    // Announce for screen readers
    announceToScreenReader("Invalid model selection. Please try again");
  }
}

// Display theme selection options
function displayThemeOptions() {
  let themeText = "\n";
  availableThemes.forEach((theme) => {
    themeText += `${theme.id}. ${theme.theme}\n`;
  });
  typeText(themeText + "\n");
}

// Handle theme selection
function handleThemeSelection(selection) {
  const themeOption = availableThemes.find(
    (t) =>
      t.id === selection || t.theme.toLowerCase() === selection.toLowerCase()
  );

  if (themeOption) {
    gameState.world.theme = themeOption.theme;
    gameState.waitingForThemeSelection = false;
    gameState.gameStarted = true;

    // Announce for screen readers
    announceToScreenReader(
      `Theme selected: ${themeOption.theme}. Initializing game...`
    );

    typeText(
      `\nTheme selected: ${themeOption.theme}\n\nInitializing game...\n\n`,
      () => {
        startGameWithTheme(themeOption.theme);
      }
    );
  } else {
    typeText(
      "Invalid theme selection. Please select a valid theme number or name:\n\n"
    );
    displayThemeOptions();

    // Announce for screen readers
    announceToScreenReader("Invalid theme selection. Please try again");
  }
}

// Resume loaded game
function resumeLoadedGame() {
  // Show loading spinner
  showLoadingSpinner("Resuming your adventure...");

  // Ask the AI "where am I?" to resume the game
  gameState.conversation.push({
    role: "user",
    content:
      "Where am I? (Please summarize my current situation and continue the adventure.)"
  });

  // Get response from API
  sendToAPI(gameState.conversation)
    .then((response) => {
      hideLoadingSpinner();
      processGameResponse(response);

      // Announce for screen readers
      announceToScreenReader("Game resumed. Adventure continues!");
    })
    .catch((error) => {
      hideLoadingSpinner();
      typeText(
        `Error resuming game: ${error.message}\nPlease try again with 'wake up' command.\n`
      );
      resetGameState();

      // Announce for screen readers
      announceToScreenReader(
        `Error resuming game: ${error.message}. Please try again.`
      );
    });
}

// Start game with selected theme
async function startGameWithTheme(theme) {
  // Show loading spinner
  showLoadingSpinner("Creating your adventure...");

  // Create system prompt with theme
  const systemPrompt = `You are RPG-Bot – an immersive, interactive role-playing game engine set in a ${theme} setting. Your role is to provide an engaging narrative experience that blends role-play, combat, puzzles, and exploration while strictly adhering to game mechanics, lore, and narrative tone. You must remain fully in character at all times and never deviate from the instructions below or the strict JSON response format. Do not include any additional text, commentary, or explanation outside the prescribed format.

[INSTRUCTIONS]
- Game State Management:
  - Track and update player stats (health, inventory, location) precisely.
  - Implement hidden skill checks as needed.
  - Starting Item Assignment: At game initialization, assign a starting item that fits the game’s theme, setting, and the player’s implied background. Add this item to the player's inventory.
- Narrative & Tone:
  - Deliver immersive, concise descriptions that draw the player into the game world.
  - Maintain a tone consistent with the game’s theme and lore.
- World-Building & NPCs:
  - Provide detailed descriptions of locations.
  - Create distinct NPCs with engaging personalities that influence the narrative.
- Mechanics & Progression:
  - Handle combat dice rolls, XP assignment, and character leveling.
  - Allow for character death, ending the game only if the character dies.
- Overall Guidelines:
  - Adapt to player choices, ensuring all options reflect the current narrative context.
  - Balance storytelling with game mechanics.
  - Always output your responses in the exact JSON format specified below.

[RESPONSE FORMAT]
You must respond in valid JSON following this exact schema with no extra text or commentary:

{
  "narrative": "Detailed story text describing the current situation",
  "options": [
    {"id": 1, "text": "First clear option"},
    {"id": 2, "text": "Second clear option"},
    {"id": 3, "text": "Third clear option"}
  ],
  "stats": {
    "health": ${gameState.player.health},
    "inventory": ${JSON.stringify(gameState.player.inventory)},
    "location": "${gameState.world.currentLocation}"
  }
}
`;

  // Initialize conversation with system prompt
  gameState.conversation = [
    {
      role: "system",
      content: systemPrompt
    },
    {
      role: "user",
      content:
        "Please start the game and describe the opening scene. Introduce the player's initial surroundings with immersive details, set the tone for adventure in a ${theme} setting, and present three clear options for the player to choose from. Ensure your response strictly follows the JSON format provided in the system prompt. Use the current timestamp (Date: YYYY-MM-DD, Hour: HH, Minute: MM, Second: SS, Centisecond: CC, Millisecond: MMM) as a seed value for randomness"
    }
  ];

  // Get response from API
  try {
    // Get response from API
    const response = await sendToAPI(gameState.conversation);
    hideLoadingSpinner();
    processGameResponse(response);

    // Announce for screen readers
    announceToScreenReader("Game started. Adventure begins!");
  } catch (error) {
    hideLoadingSpinner();
    typeText(
      `Error starting game: ${error.message}\nPlease try again with 'wake up' command.\n`
    );
    resetGameState();

    // Announce for screen readers
    announceToScreenReader(
      `Error starting game: ${error.message}. Please try again.`
    );
  }
}

// Handle game choice
async function handleGameChoice(choiceText) {
  // Add user choice to conversation
  gameState.conversation.push({
    role: "user",
    content: choiceText
  });

  // Announce for screen readers
  announceToScreenReader(`Option selected: ${choiceText}`);

  showLoadingSpinner("Processing your choice...");

  typeText(`> ${choiceText}`, async () => {
    try {
      const response = await sendToAPI(gameState.conversation);
      hideLoadingSpinner();
      processGameResponse(response);
    } catch (error) {
      hideLoadingSpinner();
      typeText(`Error processing choice: ${error.message}\n`);

      // Announce for screen readers
      announceToScreenReader(`Error processing choice: ${error.message}`);
    }
  });
}

// Process game response from API
function processGameResponse(responseData) {
  try {
    // Extract content from response
    const content = responseData.choices[0].message.content;

    // Parse JSON from content (remove markdown if present)
    const jsonContent = content.replace(/```json|```/g, "").trim();
    const gameResponse = JSON.parse(jsonContent);

    // Update game state
    gameState.player.health = gameResponse.stats.health;
    gameState.player.inventory = gameResponse.stats.inventory;
    gameState.world.currentLocation = gameResponse.stats.location;
    gameState.options = gameResponse.options;

    // Add AI response to conversation history
    gameState.conversation.push({
      role: "assistant",
      content: content
    });

    // Display narrative and options in pure text format
    displayGameResponse(gameResponse);

    // Announce for screen readers
    announceToScreenReader(
      "New game content available. Narrative and options updated."
    );
  } catch (error) {
    typeText(`Error parsing game response: ${error.message}\n`);
    console.error("Original response:", responseData);

    // Announce for screen readers
    announceToScreenReader(`Error parsing game response: ${error.message}`);
  }
}

function displayGameResponse(gameResponse) {
  // Set typing flag to true
  disableInput();

  // Add separator before everything is typed
  typeText(
    "\n------------------------------------------------------------\n\n",
    () => {
      // First, type out the narrative with animation
      typeText(gameResponse.narrative, () => {
        // After narrative is complete, type out the options
        let optionsText = "\nWhat do you want to do?:\n";
        gameResponse.options.forEach((option) => {
          optionsText += `${option.id}. ${option.text}\n`;
        });

        // Type out options with animation
        typeText(optionsText, () => {
          // Then type out the stats
          let statsText = "\nStats:\n";
          statsText += `Health: ${gameResponse.stats.health}\n`;
          statsText += `Location: ${gameResponse.stats.location}\n`;
          statsText += `Inventory: ${
            gameResponse.stats.inventory.length > 0
              ? gameResponse.stats.inventory.join(", ")
              : "Empty"
          }`;

          // Type out stats with animation
          typeText(statsText, () => {
            // Add separator after everything is typed
            typeText(
              "\n------------------------------------------------------------\n",
              () => {
                // Enable input after everything is displayed
                enableInput();
              }
            );

            // Scroll to bottom
            terminalOutput.scrollTop = terminalOutput.scrollHeight;
          });
        });
      });
    }
  );
}

// Send messages to the API
async function sendToAPI(messages) {
  try {
    // Show loading spinner
    gameState.isProcessing = true;

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${gameState.apiKey}`,
          "HTTP-Referer": window.location.href,
          "X-Title": "Terminal RPG",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: gameState.selectedModel,
          messages: messages,
          temperature: 0.7
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error?.message || `API error: ${response.status}`
      );
    }

    return await response.json();
  } catch (error) {
    throw new Error(`API request failed: ${error.message}`);
  } finally {
    gameState.isProcessing = false;
  }
}

// Save game - simplified to be purely command-based
function saveGame() {
  if (!gameState.gameStarted) {
    typeText("You need to start a game before saving.\n");
    return;
  }

  // Create save data
  const saveData = JSON.stringify(gameState, null, 2);
  const blob = new Blob([saveData], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  // Create filename with date and theme
  const now = new Date();
  const date = `${("0" + now.getDate()).slice(-2)}${(
    "0" +
    (now.getMonth() + 1)
  ).slice(-2)}${now.getFullYear()}`;
  const time = `${("0" + now.getHours()).slice(-2)}${(
    "0" + now.getMinutes()
  ).slice(-2)}`;
  const theme = gameState.world.theme.replace(/\s+/g, "");
  const filename = `TerminalRPG_${theme}-${date}-${time}.json`;

  // Create download link
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  typeText(
    `Game saved as "${filename}".\nYour journey continues. What will you do?\n`
  );

  // Announce for screen readers
  announceToScreenReader(`Game saved as ${filename}`);
}

// Load game - still needs file input but simplified UI
function loadGame() {
  if (gameState.gameStarted) {
    typeText(
      "You cannot load a game while another one is in progress. Please restart first with 'wake up' command.\n"
    );
    return;
  }

  typeText("Please select your save file to load:\n", () => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json";
    fileInput.style.display = "none";
    fileInput.setAttribute("aria-label", "Select save file to load");

    // Announce for screen readers
    announceToScreenReader("Please select your save file to load");

    document.body.appendChild(fileInput);

    fileInput.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (file) {
        const reader = new FileReader();

        showLoadingSpinner("Loading saved game...");

        reader.onload = (e) => {
          try {
            const savedGameState = JSON.parse(e.target.result);

            // Validate save file
            if (!savedGameState.conversation || !savedGameState.player) {
              throw new Error("Invalid save file format.\n");
            }

            // Restore game state
            Object.assign(gameState, savedGameState);
            hideLoadingSpinner();

            // Make sure we have an API key
            if (!gameState.apiKey) {
              const savedApiKey = localStorage.getItem("apiKey");
              if (savedApiKey) {
                gameState.apiKey = savedApiKey;
                gameState.waitingForModelSelection = true;
                typeText(
                  "Save game loaded. Please select an LLM model by typing its number:\n",
                  () => {
                    displayModelOptions();
                  }
                );
              } else {
                gameState.waitingForApiKey = true;
                typeText(
                  "Save game loaded, but no API key found. Please enter your OpenRouter API key (starts with sk-or-...):\n"
                );
              }
            } else {
              // Go straight to model selection
              gameState.waitingForModelSelection = true;
              typeText(
                "Save game loaded. Please select an LLM model by typing its number:\n",
                () => {
                  displayModelOptions();
                }
              );
            }

            // Announce for screen readers
            announceToScreenReader("Game loaded successfully");
          } catch (error) {
            hideLoadingSpinner();
            typeText(`Error loading save file: ${error.message}\n`);

            // Announce for screen readers
            announceToScreenReader(`Error loading save file: ${error.message}`);
          }
        };

        reader.readAsText(file);
      }

      document.body.removeChild(fileInput);
      commandInput.focus();
    });

    fileInput.click();
  });
}

// Show loading spinner - kept for user feedback
function showLoadingSpinner(message = "Processing...") {
  const spinner = document.getElementById("loading-spinner");
  const spinnerText = spinner.querySelector("p");
  spinnerText.textContent = message;
  spinner.classList.remove("hidden");

  // Also disable input during loading
  disableInput();

  // Announce for screen readers
  announceToScreenReader(message);
}

// Hide loading spinner
function hideLoadingSpinner() {
  const spinner = document.getElementById("loading-spinner");
  spinner.classList.add("hidden");

  // Don't enable input here as we may be entering typeText immediately after
}

// Disable input during typing
function disableInput() {
  gameState.isTyping = true;
  commandInput.disabled = true;
  commandInput.classList.add("disabled");
}

// Enable input after typing is complete
function enableInput() {
  gameState.isTyping = false;
  commandInput.disabled = false;
  commandInput.classList.remove("disabled");
  commandInput.focus();
}

// Type text with animation effect - modified to control input state
function typeText(text, callback) {
  // Make sure input is disabled while typing
  disableInput();

  const element = document.createElement("div");
  element.className = "terminal-line";
  gameNarrative.appendChild(element);

  // Original plain text typing
  let index = 0;
  const speed = 25; // Faster typing speed for terminal feel

  function typeNextChar() {
    if (index < text.length) {
      element.textContent += text.charAt(index);
      index++;
      setTimeout(typeNextChar, speed);

      // Auto-scroll to bottom
      terminalOutput.scrollTop = terminalOutput.scrollHeight;
    } else {
      // If we have a callback, call it - otherwise enable input
      if (callback) {
        callback();
      } else {
        enableInput();
      }
    }
  }

  typeNextChar();
}
