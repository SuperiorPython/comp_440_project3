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
let animationId;

let vault;
let guards;
let beacons;
let beaconCooldown;
let lastGuardSpawnTime;

const WIN_TIME = 90;
const VAULT_RADIUS = 30;
const STARTING_VAULT_NOISE = 20;
const VAULT_NOISE_GROWTH = 1.5;

const BEACON_DURATION = 5;
const BEACON_COOLDOWN = 2;
const BEACON_STRENGTH = 180;

const GUARD_RADIUS = 15;
const VAULT_SOUND_RADIUS = 60;
const MAX_VAULT_SOUND_RADIUS = 230;
const BEACON_SOUND_RADIUS = 160;
const WANDER_TARGET_DISTANCE = 20;

const GUARD_SPAWN_INTERVAL = 15;
const STARTING_GUARD_COUNT = 3;

function initGame() {
    if (animationId) {
        cancelAnimationFrame(animationId);
    }

    gameState = "start";
    survivalTime = 0;
    lastTimestamp = 0;
    beaconCooldown = 0;
    lastGuardSpawnTime = 0;

    vault = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        noiseLevel: STARTING_VAULT_NOISE
    };

    guards = [
        createGuard(80, 80, 0.85),
        createGuard(720, 80, 0.85),
        createGuard(400, 440, 0.85)
    ];

    beacons = [];

    messageDisplay.textContent = "Click anywhere inside the room to place a sound beacon.";

    updateHUD();
    drawGame();

    animationId = requestAnimationFrame(gameLoop);
}

function createGuard(x, y, speed) {
    return {
        x: x,
        y: y,
        speed: speed,
        targetX: x,
        targetY: y,
        mode: "wandering"
    };
}

function startGame() {
    gameState = "playing";
    survivalTime = 0;
    lastTimestamp = 0;
    lastGuardSpawnTime = 0;
    messageDisplay.textContent = "Protect the vault. Use beacons to lure guards away.";
}

function placeBeacon(event) {
    if (gameState !== "playing") {
        return;
    }

    if (beaconCooldown > 0) {
        messageDisplay.textContent = "Beacon is recharging.";
        return;
    }

    const maxActiveBeacons = getMaxActiveBeacons();

    if (beacons.length >= maxActiveBeacons) {
        messageDisplay.textContent = "Maximum active beacons reached.";
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

    messageDisplay.textContent = "Beacon placed.";
}

function getMaxActiveBeacons() {
    return Math.floor(guards.length / 2);
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
        spawnGuardsOverTime();
        updateGuards();
        checkVaultCollision();
        updateHUD();
        drawGame();

        if (survivalTime >= WIN_TIME) {
            endGame("win");
        }
    }

    animationId = requestAnimationFrame(gameLoop);
}

function spawnGuardsOverTime() {
    if (survivalTime - lastGuardSpawnTime >= GUARD_SPAWN_INTERVAL) {
        const spawnPoint = getRandomSpawnPoint();
        const speed = 0.85 + guards.length * 0.03;

        guards.push(createGuard(spawnPoint.x, spawnPoint.y, speed));
        lastGuardSpawnTime = survivalTime;

        messageDisplay.textContent = "Another guard entered the room.";
    }
}

function getRandomSpawnPoint() {
    const side = Math.floor(Math.random() * 4);

    if (side === 0) {
        return { x: 30, y: Math.random() * canvas.height };
    } else if (side === 1) {
        return { x: canvas.width - 30, y: Math.random() * canvas.height };
    } else if (side === 2) {
        return { x: Math.random() * canvas.width, y: 30 };
    } else {
        return { x: Math.random() * canvas.width, y: canvas.height - 30 };
    }
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

    const maxActiveBeacons = getMaxActiveBeacons();

    if (beaconCooldown <= 0) {
        cooldownDisplay.textContent = "Ready | Beacons: " + beacons.length + "/" + maxActiveBeacons;
    } else {
        cooldownDisplay.textContent = beaconCooldown.toFixed(1) + "s | Beacons: " + beacons.length + "/" + maxActiveBeacons;
    }
}

function updateGuards() {
    guards.forEach(function(guard) {
        const soundTarget = findSoundTargetInRange(guard);

        if (soundTarget) {
            guard.mode = "alert";
            guard.targetX = soundTarget.x;
            guard.targetY = soundTarget.y;
        } else {
            guard.mode = "wandering";
            updateWanderTarget(guard);
        }

        moveGuardTowardTarget(guard);
    });
}

function findSoundTargetInRange(guard) {
    let bestTarget = null;
    let bestPull = 0;

    const currentVaultSoundRadius = Math.min(
        VAULT_SOUND_RADIUS + vault.noiseLevel,
        MAX_VAULT_SOUND_RADIUS
    );

    const distanceToVault = getDistance(guard.x, guard.y, vault.x, vault.y);

    if (distanceToVault <= currentVaultSoundRadius) {
        const vaultPull = vault.noiseLevel / Math.max(distanceToVault, 1);

        bestTarget = {
            x: vault.x,
            y: vault.y
        };

        bestPull = vaultPull;
    }

    beacons.forEach(function(beacon) {
        const distanceToBeacon = getDistance(guard.x, guard.y, beacon.x, beacon.y);

        if (distanceToBeacon <= BEACON_SOUND_RADIUS) {
            const beaconPull = beacon.strength / Math.max(distanceToBeacon, 1);

            if (beaconPull > bestPull) {
                bestTarget = {
                    x: beacon.x,
                    y: beacon.y
                };

                bestPull = beaconPull;
            }
        }
    });

    return bestTarget;
}

function updateWanderTarget(guard) {
    const distanceToTarget = getDistance(guard.x, guard.y, guard.targetX, guard.targetY);

    if (distanceToTarget <= WANDER_TARGET_DISTANCE) {
        guard.targetX = Math.random() * canvas.width;
        guard.targetY = Math.random() * canvas.height;
    }
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

        if (distanceToVault <= VAULT_RADIUS + GUARD_RADIUS) {
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
    const currentVaultSoundRadius = Math.min(
        VAULT_SOUND_RADIUS + vault.noiseLevel,
        MAX_VAULT_SOUND_RADIUS
    );

    ctx.beginPath();
    ctx.arc(vault.x, vault.y, currentVaultSoundRadius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(250, 204, 21, 0.25)";
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
        ctx.arc(guard.x, guard.y, GUARD_RADIUS, 0, Math.PI * 2);

        if (guard.mode === "alert") {
            ctx.fillStyle = "#ef4444";
        } else {
            ctx.fillStyle = "#a855f7";
        }

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
        ctx.arc(beacon.x, beacon.y, BEACON_SOUND_RADIUS, 0, Math.PI * 2);
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
