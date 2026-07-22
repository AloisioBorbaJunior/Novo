// Função de cadastro
function register() {
  const user = document.getElementById("newUser").value;
  const pass = document.getElementById("newPass").value;
  const message = document.getElementById("register-message");

  if (user && pass) {
    // Salva no localStorage
    localStorage.setItem(user, pass);
    message.style.color = "green";
    message.textContent = "Usuário cadastrado com sucesso!";
  } else {
    message.style.color = "red";
    message.textContent = "Preencha todos os campos!";
  }
}

// Função de login
function login() {
  const user = document.getElementById("username").value;
  const pass = document.getElementById("password").value;
  const errorMessage = document.getElementById("error-message");

  const savedPass = localStorage.getItem(user);

  if (savedPass && savedPass === pass) {
    window.location.href = "index-principal.html";
  } else {
    errorMessage.textContent = "Usuário ou senha incorretos!";
  }
}