// Function to manage save/load button visibility
function updateSaveControlsVisibility(gameInProgress) {
  const saveControls = document.querySelector(".save-controls");
  const exportButton = document.getElementById("exportGame");
  const importButton = document.getElementById("importGame");
  if (gameInProgress) {
    // When game is in progress, show only the export button
    saveControls.style.display = "block";
    exportButton.style.display = "block";
    importButton.style.display = "none";
  } else {
    // When on the setup screen, show only the import button
    saveControls.style.display = "block";
    exportButton.style.display = "none";
    importButton.style.display = "block";
  }
}
// Main game state object
let gameState = {
  player: {
    health: 100,
    inventory: []
  },
  world: {
    currentLocation: "Starting point"
  },
  conversation: []
};
// DOM elements
const setupPanel = document.getElementById("setupPanel");
const themeSelector = document.getElementById("themeSelector");
const gamePanel = document.getElementById("gamePanel");
const inputPanel = document.getElementById("inputPanel");
const loadingIndicator = document.getElementById("loadingIndicator");
const optionsContainer = document.getElementById("optionsContainer");
const apiKeyInput = document.getElementById("apiKey");
const validateApiKeyButton = document.getElementById("validateApiKey");
const apiKeyStatus = document.getElementById("apiKeyStatus");
const exportGameButton = document.getElementById("exportGame");
const importGameButton = document.getElementById("importGame");
const importFileInput = document.getElementById("importFile");
const diedModal = document.getElementById("died-modal");
const newGameButton = document.getElementById("newGameButton");
// Selected model and system prompt
let selectedModel = "";
let systemPrompt = "";
// Validate API key
validateApiKeyButton.addEventListener("click", async () => {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    apiKeyStatus.textContent = "Please enter an API key.";
    apiKeyStatus.style.color = "#991f36";
    return;
  }
  loadingIndicator.style.display = "block";
  apiKeyStatus.textContent = "Validating key...";
  apiKeyStatus.style.color = "#991f36";
  try {
    const response = await fetch("https://openrouter.ai/api/v1/auth/key", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      }
    });
    const data = await response.json();
    if (response.ok) {
      // Save API key to localStorage
      localStorage.setItem("apiKey", apiKey);
      // Get available models
      selectedModel = "google/gemini-2.0-flash-thinking-exp:free"; // Default model
      apiKeyStatus.textContent = "API key validated successfully!";
      themeSelector.style.display = "block";
    } else {
      apiKeyStatus.textContent = "Invalid API key. Please try again.";
      apiKeyStatus.style.color = "#991f36";
    }
  } catch (error) {
    apiKeyStatus.textContent = "Error validating API key: " + error.message;
    apiKeyStatus.style.color = "#991f36";
  } finally {
    loadingIndicator.style.display = "none";
  }
});
// Theme selection
document.querySelectorAll(".theme-button").forEach((button) => {
  button.addEventListener("click", () => {
    const theme = button.getAttribute("data-theme");
    loadTheme(theme);
  });
});
// Load theme and start game
async function loadTheme(theme) {
  loadingIndicator.style.display = "block";
  // Build system prompt with chosen theme
  systemPrompt = `**You are RPG-Bot – an immersive, interactive role-playing game engine in a ${theme} setting. Follow these rules precisely to maintain game mechanics, narrative consistency, and player immersion.**
---
**[INSTRUCTIONS]**
- **Game State Management:**  
  - Update player stats with any changes (health, inventory, location).  
  - Include hidden skill checks as needed.
- **Narrative & Tone:**  
  - Provide concise but immersive descriptions.  
  - Tell a compelling story that integrates role-play, combat, and puzzles.  
  - Maintain a tone that fits the CHARACTER and adheres strictly to the GAME's theme and lore.
- **World-Building & NPCs:**  
  - Provide focused descriptions of each location.
  - Create NPCs with distinct personalities that influence the narrative.
- **Mechanics & Progression:**  
  - Manage combat dice rolls, track CHARACTER progress, assign XP, and handle leveling.  
  - Allow the possibility of character death and only end the game if the CHARACTER dies.
- **Overall Guidelines:**  
  - Adapt to player choices, ensuring every option reflects the current danger level and narrative context.
  - Balance storytelling with the GAME's core mechanics.
  - Use formatting in the narrative text where appropriate.

**[RESPONSE FORMAT]**
You must respond in valid JSON format following this exact schema with no extra text before or after:

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
---`;
  // Reset game state
  gameState = {
    player: {
      health: 100,
      inventory: []
    },
    world: {
      currentLocation: "Starting point"
    },
    conversation: [
      {
        role: "system",
        content: systemPrompt
      }
    ]
  };
  // Hide setup panel and show game panels
  setupPanel.style.display = "none";
  gamePanel.style.display = "block";
  inputPanel.style.display = "block";
  // Update save controls: game in progress → show only export button
  updateSaveControlsVisibility(true);
  // Send initial message to start the game
  await sendMessage("start");
}
// Send message to API
async function sendMessage(message) {
  loadingIndicator.style.display = "block";
  inputPanel.style.display = "none";
  // Add user message to conversation history (if not starting)
  if (message !== "start") {
    appendToGamePanel("user-input", `> ${message}`);
    gameState.conversation.push({
      role: "user",
      content: message
    });
  } else {
    gameState.conversation.push({
      role: "user",
      content: "Please start the game and describe the opening scene."
    });
  }
  try {
    const apiKey = localStorage.getItem("apiKey");
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": window.location.href,
          "X-Title": "Terminal RPG",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: gameState.conversation,
          temperature: 0.7
        })
      }
    );
    const data = await response.json();
    const content = data.choices[0].message.content;
    // Parse the JSON from the response (handle markdown code blocks if needed)
    try {
      let jsonContent = content;
      const jsonRegex = /```(?:json)?\s*([\s\S]*?)```/;
      const match = content.match(jsonRegex);
      if (match && match[1]) {
        jsonContent = match[1].trim();
      }
      const parsedResponse = JSON.parse(jsonContent);
      // Update game state from parsed response
      gameState.player.health = parsedResponse.stats.health;
      gameState.player.inventory = parsedResponse.stats.inventory;
      gameState.world.currentLocation = parsedResponse.stats.location;
      // Add assistant response to conversation history
      gameState.conversation.push({
        role: "assistant",
        content: content
      });
      // Display narrative and stats in game panel
      appendToGamePanel("narrative", parsedResponse.narrative);
      appendToGamePanel(
        "stats",
        `Health: ${parsedResponse.stats.health} | Location: ${
          parsedResponse.stats.location
        } | Inventory: ${parsedResponse.stats.inventory.join(", ") || "None"}`
      );
      // Display options
      displayOptions(parsedResponse.options);
      // If player's health is 0 or less, show death modal
      if (parsedResponse.stats.health <= 0) {
        showDeathModal();
      }
    } catch (error) {
      appendToGamePanel(
        "narrative",
        "Error parsing game response. Please try again."
      );
      console.error("Error parsing response:", error);
      console.log("Raw content:", content);
    }
  } catch (error) {
    appendToGamePanel(
      "narrative",
      "Error connecting to game server. Please check your connection and try again."
    );
    console.error("API error:", error);
  } finally {
    loadingIndicator.style.display = "none";
    inputPanel.style.display = "block";
  }
}
// Display available options
function displayOptions(options) {
  optionsContainer.innerHTML = "";
  options.forEach((option) => {
    const button = document.createElement("button");
    button.className = "option-button";
    button.textContent = `${option.id}. ${option.text}`;
    button.addEventListener("click", () => {
      sendMessage(option.id.toString());
    });
    optionsContainer.appendChild(button);
  });
}
// Append content to the game panel
function appendToGamePanel(className, content) {
  const element = document.createElement("div");
  element.className = className;
  element.innerHTML = content;
  gamePanel.appendChild(element);
  gamePanel.scrollTop = gamePanel.scrollHeight;
}
// Show death modal if player dies
function showDeathModal() {
  diedModal.style.display = "block";
}
// New game button event handler
newGameButton.addEventListener("click", () => {
  diedModal.style.display = "none";
  setupPanel.style.display = "block";
  gamePanel.style.display = "none";
  inputPanel.style.display = "none";
  themeSelector.style.display = "block";
  gamePanel.innerHTML = "";
  // Update save controls: no game active → show only import button
  updateSaveControlsVisibility(false);
});
// Export game state event
exportGameButton.addEventListener("click", () => {
  const gameData = JSON.stringify(gameState);
  const blob = new Blob([gameData], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "rpg-game-save.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});
// Import game state: trigger file selection
importGameButton.addEventListener("click", () => {
  importFileInput.click();
});
// Import game state from selected file
importFileInput.addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importedState = JSON.parse(e.target.result);
        gameState = importedState;
        // Display the game UI
        setupPanel.style.display = "none";
        gamePanel.style.display = "block";
        inputPanel.style.display = "block";
        gamePanel.innerHTML = "";
        // Update save controls: game resumed → show only export button
        updateSaveControlsVisibility(true);
        // Resume the game by sending a message
        sendMessage("Where am I?");
      } catch (error) {
        alert("Error loading save file: " + error.message);
      }
    };
    reader.readAsText(file);
  }
});
// On initial page load, check for saved API key and set default save controls (show import button)
window.addEventListener("DOMContentLoaded", () => {
  const savedApiKey = localStorage.getItem("apiKey");
  if (savedApiKey) {
    apiKeyInput.value = savedApiKey;
  }
  updateSaveControlsVisibility(false);
});
