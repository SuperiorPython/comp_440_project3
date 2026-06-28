const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const timeDisplay = document.getElementById("time-display");
const noiseDisplay = document.getElementById("noise-display");
const cooldownDisplay = document.getElementById("cooldown-display");
const messageDisplay = document.getElementById("message");
const startButton = document.getElementById("start-button");
const restartButton = document.getElementById("restart-button");

let gameState;
let survivalTime;
let lastTimestamp;

let vault;
let guards;
let beacons;
let beaconCooldown;

const WIN_TIME = 90;
const VAULT_RADIUS = 30;
const STARTING_VAULT_NOISE = 10;
const VAULT_NOISE_GROWTH = 2.5;

const BEACON_DURATION = 5;
const BEACON_COOLDOWN = 2;
const BEACON_STRENGTH = 180;

function initGame() {
    gameState = "start";
    survivalTime = 0;
    lastTimestamp = 0;
    beaconCooldown = 0;

    vault = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        noiseLevel: STARTING_VAULT_NOISE
    };

    guards = [
    { x: 80, y: 80, speed: 0.85, targetX: vault.x, targetY: vault.y },
    { x: 720, y: 80, speed: 0.85, targetX: vault.x, targetY: vault.y },
    { x: 400, y: 440, speed: 0.85, targetX: vault.x, targetY: vault.y }
    ];

    beacons = [];

    messageDisplay.textContent = "Click anywhere inside the room to place a sound beacon.";

    updateHUD();
    drawGame();

    requestAnimationFrame(gameLoop);
}

function startGame() {
    gameState = "playing";
    survivalTime = 0;
    lastTimestamp = 0;
    messageDisplay.textContent = "Protect the vault. Use beacons to lure guards away.";
}

function placeBeacon(event) {
    if (gameState !== "playing") {
        return;
    }

    if (beaconCooldown > 0) {
        return;
    }

    const rect = canvas.getBoundingClientRect();

    const beacon = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        strength: BEACON_STRENGTH,
        timeLeft: BEACON_DURATION
    };

    beacons.push(beacon);
    beaconCooldown = BEACON_COOLDOWN;
}

function gameLoop(timestamp) {
    if (lastTimestamp === 0) {
        lastTimestamp = timestamp;
    }

    const deltaTime = (timestamp - lastTimestamp) / 1000;
    lastTimestamp = timestamp;

    if (gameState === "playing") {
        survivalTime += deltaTime;

        updateVaultNoise(deltaTime);
        updateCooldown(deltaTime);
        updateBeacons(deltaTime);
        updateGuards();
        checkVaultCollision();
        updateHUD();
        drawGame();

        if (survivalTime >= WIN_TIME) {
            endGame("win");
        }
    }

    requestAnimationFrame(gameLoop);
}

function updateVaultNoise(deltaTime) {
    vault.noiseLevel += VAULT_NOISE_GROWTH * deltaTime;
}

function updateBeacons(deltaTime) {
    for (let i = beacons.length - 1; i >= 0; i--) {
        beacons[i].timeLeft -= deltaTime;

        if (beacons[i].timeLeft <= 0) {
            beacons.splice(i, 1);
        }
    }
}

function updateCooldown(deltaTime) {
    if (beaconCooldown > 0) {
        beaconCooldown -= deltaTime;
    }

    if (beaconCooldown < 0) {
        beaconCooldown = 0;
    }
}

function updateHUD() {
    timeDisplay.textContent = Math.floor(survivalTime);
    noiseDisplay.textContent = Math.floor(vault.noiseLevel);

    if (beaconCooldown <= 0) {
        cooldownDisplay.textContent = "Ready";
    } else {
        cooldownDisplay.textContent = beaconCooldown.toFixed(1) + "s";
    }
}

function updateGuards() {
    guards.forEach(function(guard) {
        const target = findLoudestSoundSource(guard);

        guard.targetX = target.x;
        guard.targetY = target.y;

        moveGuardTowardTarget(guard);
    });
}

function findLoudestSoundSource(guard) {
    let loudestSource = {
        x: vault.x,
        y: vault.y,
        strength: vault.noiseLevel
    };

    beacons.forEach(function(beacon) {
        const beaconDistance = getDistance(guard.x, guard.y, beacon.x, beacon.y);
        const vaultDistance = getDistance(guard.x, guard.y, vault.x, vault.y);

        const beaconPull = beacon.strength / Math.max(beaconDistance, 1);
        const vaultPull = vault.noiseLevel / Math.max(vaultDistance, 1);

        if (beaconPull > vaultPull) {
            loudestSource = beacon;
        }
    });

    return loudestSource;
}

function moveGuardTowardTarget(guard) {
    const dx = guard.targetX - guard.x;
    const dy = guard.targetY - guard.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 1) {
        guard.x += (dx / distance) * guard.speed;
        guard.y += (dy / distance) * guard.speed;
    }
}

function getDistance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;

    return Math.sqrt(dx * dx + dy * dy);
}

function checkVaultCollision() {
    guards.forEach(function(guard) {
        const distanceToVault = getDistance(guard.x, guard.y, vault.x, vault.y);

        if (distanceToVault <= VAULT_RADIUS + 15) {
            endGame("lose");
        }
    });
}

function drawGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawVault();
    drawGuards();
    drawBeacons();
}

function drawVault() {
    ctx.beginPath();
    ctx.arc(vault.x, vault.y, VAULT_RADIUS + vault.noiseLevel, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(250, 204, 21, 0.35)";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(vault.x, vault.y, VAULT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = "#facc15";
    ctx.fill();
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "black";
    ctx.font = "14px Arial";
    ctx.textAlign = "center";
    ctx.fillText("VAULT", vault.x, vault.y + 5);
}

function drawGuards() {
    guards.forEach(function(guard) {
        ctx.beginPath();
        ctx.moveTo(guard.x, guard.y);
        ctx.lineTo(guard.targetX, guard.targetY);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(guard.x, guard.y, 15, 0, Math.PI * 2);
        ctx.fillStyle = "#ef4444";
        ctx.fill();

        ctx.fillStyle = "white";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.fillText("G", guard.x, guard.y + 4);
    });
}

function drawBeacons() {
    beacons.forEach(function(beacon) {
        ctx.beginPath();
        ctx.arc(beacon.x, beacon.y, beacon.strength, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(beacon.x, beacon.y, 12, 0, Math.PI * 2);
        ctx.fillStyle = "#38bdf8";
        ctx.fill();

        ctx.fillStyle = "white";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(Math.ceil(beacon.timeLeft), beacon.x, beacon.y + 4);
    });
}

function endGame(result) {
    gameState = result;

    if (result === "win") {
        messageDisplay.textContent = "You protected the vault. You win!";
    } else {
        messageDisplay.textContent = "A guard reached the vault. Game over.";
    }
}

canvas.addEventListener("click", placeBeacon);
restartButton.addEventListener("click", initGame);
startButton.addEventListener("click", startGame);

initGame();
