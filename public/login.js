// login.js
const form = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
});