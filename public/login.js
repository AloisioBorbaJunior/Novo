async function sendAuthRequest(endpoint, username, password) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Não foi possível concluir a solicitação.');
  return result;
}

function showMessage(element, text, isError = true) {
  element.style.color = isError ? 'red' : 'green';
  element.textContent = text;
}

async function register() {
  const username = document.getElementById('newUser').value;
  const password = document.getElementById('newPass').value;
  const message = document.getElementById('register-message');

  try {
    const result = await sendAuthRequest('/api/auth/register', username, password);
    showMessage(message, result.message, false);
  } catch (error) {
    showMessage(message, error.message);
  }
}

async function login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const message = document.getElementById('error-message');

  try {
    const result = await sendAuthRequest('/api/auth/login', username, password);
    window.location.assign(result.redirect);
  } catch (error) {
    showMessage(message, error.message);
  }
}

async function logout() {
  try {
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    if (!response.ok) throw new Error('Não foi possível encerrar a sessão.');
    window.location.assign('/login');
  } catch (error) {
    window.alert(error.message);
  }
}

document.getElementById('logoutBtn')?.addEventListener('click', logout);