// script.js

// Animação simples de desaparecimento ao scrollar
window.addEventListener("scroll", () => {
    const elements = document.querySelectorAll(".card, .hero-text, .hero-image, .contato, .mapa");
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
    const elements = document.querySelectorAll(".card, .hero-text, .hero-image, .contato, .mapa");
    elements.forEach(el => {
      el.style.opacity = 0;
      el.style.transform = "translateY(50px)";
    });
  });
  