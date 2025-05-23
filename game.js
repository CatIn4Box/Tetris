//controllo della sessione
if (!sessionStorage.getItem("loginTimestamp") || !localStorage.getItem("loggedInUser")) {
  alert("Sessione non valida. Effettua il login.");
  window.location.href = "login.html";
}

const username = localStorage.getItem("loggedInUser");
document.getElementById("Log").innerHTML = `<b>Logged in as: ${username}<b>`;

const loginTime = sessionStorage.getItem("loginTimestamp");
const timeout = 1000*60*2; //2 minuti in millisecondi

let activityListenersAdded = false;
let sessionCheckerInterval;

//inizializza le variabili di gioco
const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d'); //The getContext() method returns an object with tools (methods) for drawing
context.scale(20, 20); //Ogni blocco sono 20px

const colors = [null, '#FF0D72', '#0DC2FF', '#0DFF72', '#F538FF', '#FF8E0D', '#FFE138', '#3877FF'];
const arena = createMatrix(12, 20); 
const player = { pos: {x: 0, y: 0}, matrix: null, score: 0 }; //Il pezzo attivo

let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;
let gameOver = false;
let gameStarted = false;

const audio = document.getElementById("game-music");
const musicToggle = document.getElementById("music-toggle");
const volumeSlider = document.getElementById("volume-slider");

function createMatrix(w, h) {
  const matrix = [];
  while (h--) //Finchè h(altezza) non diventa zero
    matrix.push(new Array(w).fill(0)); //Aggiungi una riga
  return matrix;
}

function createPiece(type) {
  if (type === 'T') return [[0,0,0],[1,1,1],[0,1,0]];
  if (type === 'O') return [[2,2],[2,2]];
  if (type === 'L') return [[0,3,0],[0,3,0],[0,3,3]];
  if (type === 'J') return [[0,4,0],[0,4,0],[4,4,0]];
  if (type === 'I') return [[0,5,0,0],[0,5,0,0],[0,5,0,0],[0,5,0,0]];
  if (type === 'S') return [[0,6,6],[6,6,0],[0,0,0]];
  if (type === 'Z') return [[7,7,0],[0,7,7],[0,0,0]];
}

function collide(arena, player) {
  const [m, o] = [player.matrix, player.pos]; //matrix, object
  for (let y = 0; y < m.length; ++y) { //scorri righe
    for (let x = 0; x < m[y].length; ++x) { //scorri colonne
      if (m[y][x] !== 0 && (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) { //salta le celle vuote del pezzo e verifica se una qualsiasi cella del pezzo coincide con una cella già occupata nell’arena.
        return true;                                                            //Se il pezzo ha un blocco qui e nello stesso punto dell’arena c’è già qualcosa, c'è una collisione
      }
    }
  }
  return false;
}

function merge(arena, player) {
  player.matrix.forEach((row, y) => { //Scorre ogni riga del pezzo
    row.forEach((value, x) => { //Scorre ogni campo nella riga
      if (value !== 0) {
        arena[y + player.pos.y][x + player.pos.x] = value; //Calcola la posizione assoluta nell’arena in base alla posizione del pezzo
      }
    });
  });
  if(dropInterval > 250) {
    dropInterval -= 1;
    document.getElementById("speed").innerText = dropInterval;
    //Velocizza la caduta di 1ms per ogni blocco piazzato
  }
}

function arenaSweep() {
  let rowCount = 1;
  outer: for (let y = arena.length - 1; y >= 0; --y) { //Scorre le righe dal basso verso l’alto.
    for (let x = 0; x < arena[y].length; ++x) {
      if (arena[y][x] === 0) continue outer; //Appena trova una cella vuota passa alla riga successiva uscendo dal ciclo
    }
    const row = arena.splice(y, 1)[0].fill(0); //Rimuove la riga completa dall'arena e la azzera
    arena.unshift(row); //Inserisce la riga in cima all’arena
    ++y;
    player.score += rowCount * 10;
    rowCount *= 2;
    if(dropInterval > 250) {
      dropInterval -= 5;
      document.getElementById("speed").innerText = dropInterval;
      //Velocizza la caduta di 5ms per ogni riga completata
    }
  }
}

function playerDrop() {
  player.pos.y++;
  if (collide(arena, player)) {
    player.pos.y--; //Si è verificata una collisione quindi torno alla posizione precedente
    merge(arena, player);
    playerReset();
    arenaSweep();
    updateScore();
  }
  dropCounter = 0;
}

function playerMove(dir) {
  player.pos.x += dir; //+1 a dx e -1 a sx
  if (collide(arena, player)) player.pos.x -= dir; //Si è verificata una collisione quindi torno alla posizione precedente
}

function playerRotate(dir) {
  const pos = player.pos.x; //Salva la posizione
  let offset = 1; //Serve a spostare eventualmente il pezzo
  rotate(player.matrix, dir);
  while (collide(arena, player)) { //Verifica della collisione in seguito alla rotazione
    player.pos.x += offset; //Cerca di aggiustare la posizione del pezzo in seguito alla collisione
    offset = -(offset + (offset > 0 ? 1 : -1)); //Controlla i possibili aggiustamenti 
    if (offset > player.matrix[0].length) { //Se non è possibile effettuare la rotazione (lo spostamento è maggiore della lunghezza del blocco)
      rotate(player.matrix, -dir); //Rispristino la matrice del pezzo
      player.pos.x = pos; //Rispristina la posizione iniziale
      return;
    }
  }
}

function rotate(matrix, dir) {
  for (let y = 0; y < matrix.length; ++y) {
    for (let x = 0; x < y; ++x) {
      [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]]; //Scambia righe con colonne
    }
  }
  dir > 0 ? matrix.forEach(row => row.reverse()) : matrix.reverse(); //Si usa per ruotare in senso antiorario
  //dir > 0 ? ... : ... ; è la versione abbreviata di if(dir > 0){...}; else{...};
}

function playerReset() {
  const pieces = 'TJLOSZI'; //Stringa che usiamo come vettore di caratteri
  player.matrix = createPiece(pieces[Math.random() * pieces.length | 0]); //Crea il pezzo scelto randomicamente nel vettore
  player.pos.y = 0; //Porta il pezzo all'inizio del canvas
  player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0); //Posiziona il pezzo al centro (l'Or serve a rimuovere i decimali e rendere quindi il valore un intero)

  if (collide(arena, player)) {
    gameOver = true;
    showPopup();
  }
}

function drawMatrix(matrix, offset) {
  matrix.forEach((row, y) => { //Scorre ogni riga
    row.forEach((value, x) => { //Scorre ogni campo
      if (value !== 0) {
        context.fillStyle = colors[value]; //Imposta il colore di riempimento per il pezzo
        context.fillRect(x + offset.x, y + offset.y, 1, 1); //Disegna il blocco
      }
    });
  });
}

function draw() {
  context.fillStyle = '#000'; //Imposta il colore a nero
  context.fillRect(0, 0, canvas.width, canvas.height);
  drawMatrix(arena, {x:0, y:0}); //Disegna l'area di gioco a coordinate dell'offset (0,0) cioè l'angolo in alto a sx
  drawMatrix(player.matrix, player.pos); //Disegna la matrice del pezzo attraverso la sua posizione
}

function update(time = 0) {
  if (!gameStarted) return;
  const deltaTime = time - lastTime; //Calcola il tempo trascorso dall'ultimo frame
  lastTime = time; //Aggiorna l'ultimo tempo registrato
  dropCounter += deltaTime; //Aggiungi tempo al contatore di caduta
  if (dropCounter > dropInterval && !gameOver) { //Controlla se è ora di far cadere il pezzo
    playerDrop();
  }
  draw();
  requestAnimationFrame(update); //Richiama questa funzione al prossimo frame
}

function updateScore() {
  document.getElementById('score').innerText = player.score;
}

function hidePopup() {
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('popup').style.display = 'none';
}

function clearArena() {
  for (let y = 0; y < arena.length; ++y) {
    arena[y].fill(0); //Svuota l'area di gioco
  }
}

function playMusic() {
  audio.play();
}

function pauseMusic() {
  audio.pause();
}

function startGame() {
  document.getElementById('startScreen').style.display = 'none';
  hidePopup();
  clearArena();
  dropInterval = 1000;
  document.getElementById("speed").innerText = dropInterval
  player.score = 0;
  updateScore();
  gameOver = false;
  gameStarted = true;
  playerReset();
  update();
  renderScoreboard();

  document.addEventListener('keydown', event => {
    switch(event.code) {
      case 'ArrowLeft':
        playerMove(-1);
        break;
      case 'ArrowRight':
        playerMove(1);
        break;
      case 'ArrowDown':
        playerDrop();
        break;
      case 'ArrowUp':
        playerRotate(1);
        break;
    }
  });

  if (!activityListenersAdded) {
    document.addEventListener("mousemove", resetSessionTimer);
    document.addEventListener("keydown", resetSessionTimer);
    document.addEventListener("click", resetSessionTimer);
    activityListenersAdded = true;
  }

  // Avvia controllo AFK ogni 10 secondi
  if (!sessionCheckerInterval) {
    sessionCheckerInterval = setInterval(checkAFK, 10000);
  }
}

function logout() {
  localStorage.removeItem("loggedInUser");
  clearInterval(sessionCheckerInterval); //Ferma il controllo della sessione
  window.location.href = "login.html";
}

function checkAFK() {
  const loginTime = sessionStorage.getItem("loginTimestamp");
  if (!loginTime || (Date.now() - parseInt(loginTime)) > timeout) { //Se NON esiste il timestamp OPPURE Se il tempo attuale meno il timestamp è maggiore di 2 minuti
    sessionStorage.clear(); //Cancella tutti i dati della sessione
    alert("Sessione scaduta. Effettua nuovamente il login.");
    window.location.href = "login.html";
  }
}

function resetSessionTimer() {
  checkAFK(); //Verifica se la sessione è già scaduta
  sessionStorage.setItem("loginTimestamp", Date.now()); //Aggiorna il timestamp a "now" per resettare il contatore
}

function saveBestScore(username, score) {
  let scores = JSON.parse(localStorage.getItem("scoreboard")) || {}; //Prende la classifica OPPURE un oggetto vuoto nel caso questa non esista
  if (!scores[username] || score > scores[username]) { //Se l'utente NON è in classifica OPPURE ha battuto il suo record
    scores[username] = score; //Aggiorna il punteggio
    localStorage.setItem("scoreboard", JSON.stringify(scores)); //Salva la classifica
  }
}

function renderScoreboard() {
  const tbody = document.getElementById("scoreboard-body");
  tbody.innerHTML = "";

  const scores = JSON.parse(localStorage.getItem("scoreboard")) || {}; //Prende la classifica OPPURE un oggetto vuoto nel caso questa non esista

  const sorted = Object.entries(scores) //Converte l'oggetto in array
    .sort((a, b) => b[1] - a[1]) //Ordina per punteggio decrescente
    .slice(0, 10); //Mostra i primi 10

  sorted.forEach(([username, score]) => { //Per ogni user crea una nuova riga nella tabella
    const row = document.createElement("tr");
    row.innerHTML = `<td>${username}</td><td>${score}</td>`;
    tbody.appendChild(row);
  });
}

function settingMenu() {
  const menu = document.getElementById("settings-menu");
  menu.classList.toggle("show");

  if (menu.classList.contains("show")) {
    document.addEventListener("keydown", escKeyHandler);
    volumeSlider.addEventListener("input", () => { //Prende in input il valore che viene dato in imput di tipo range
    audio.volume = parseFloat(volumeSlider.value);
  });
  } else {
    document.removeEventListener("keydown", escKeyHandler);
    volumeSlider.removeEventListener("input", () => {
  });
  }
}

function escKeyHandler(e) {
  const menu = document.getElementById("settings-menu");
  menu.classList.remove("show");
  document.removeEventListener("keydown", escKeyHandler);
}

function changeDifficulty(diff) {
  switch (diff) {
    case 1: dropInterval = 1000;
      break;
    case 2: dropInterval = 500;
      break;
    case 3: dropInterval = 250;
      break;
  }
  document.getElementById("speed").innerText = dropInterval;
}

function showPopup() {
  const username = localStorage.getItem("loggedInUser");
  saveBestScore(username, player.score);
  renderScoreboard();

  document.getElementById('overlay').style.display = 'block';
  document.getElementById('popup').style.display = 'block';
  document.getElementById('popup').innerHTML = `
    <h3>Game Over!</h3>
    <p>Punteggio Finale: ${player.score}</p>
    <button onclick="startGame()">Play again!</button>
  `;
}

// Avvio schermata iniziale
document.getElementById('startScreen').style.display = 'block';