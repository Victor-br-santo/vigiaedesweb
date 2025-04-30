// script.js

// Animação simples de desaparecimento ao scrollar
window.addEventListener("scroll", () => {
    const elements = document.querySelectorAll(".card, .contato, .mapa, .whatsapp, .sobre-nos, .secao-mvv, .parceiros, .footer");
    const windowHeight = window.innerHeight;
  
    elements.forEach(el => {
      const elementTop = el.getBoundingClientRect().top;
      if (elementTop < windowHeight - 100) {
        el.style.opacity = 1;
        el.style.transform = "translateY(0)";
        el.style.transition = "all 0.6s ease-out";
      } else {
        el.style.opacity = 0;
        el.style.transform = "translateY(50px)";
      }
    });
  });
  
  // Inicializa com opacidade zero para os elementos
  window.addEventListener("DOMContentLoaded", () => {
    const elements = document.querySelectorAll(".card, .contato, .mapa, .secao-mvv, .parceiros, .footer");
    elements.forEach(el => {
      el.style.opacity = 0;
      el.style.transform = "translateY(50px)";
    });
  });
  
  // Script para mudar a navbar quando rolar a página
window.addEventListener('scroll', function() {
  const navbar = document.querySelector('.navbar');
  
  if (window.scrollY > 150) { 
    navbar.classList.add('navbar-rolagem');
  } else {
    navbar.classList.remove('navbar-rolagem');
  }
});
