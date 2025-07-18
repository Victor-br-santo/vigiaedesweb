// Barra de pesquisa - filtra os cards pelo título e texto
const searchInput = document.getElementById('searchInput');
const postsGrid = document.getElementById('postsGrid');
const cards = Array.from(postsGrid.querySelectorAll('.post-card'));

searchInput.addEventListener('input', () => {
  const term = searchInput.value.trim().toLowerCase();

  cards.forEach(card => {
    const title = card.dataset.title.toLowerCase();
    const content = card.querySelector('p').textContent.toLowerCase();

    if (title.includes(term) || content.includes(term)) {
      card.style.display = 'flex';
    } else {
      card.style.display = 'none';
    }
  });
});

// Função para simular o clique no botão saiba mais ou imagem
postsGrid.addEventListener('click', e => {
  const btn = e.target.closest('.btn-saiba-mais');
  const card = e.target.closest('.post-card');

  if (btn || card) {
    const postTitle = card.dataset.title;
    alert(`Você clicou para ver o post: "${postTitle}"\nTela de post detalhada aqui.`);
    // Aqui você pode redirecionar para página real, ex:
    // window.location.href = `/post.html?title=${encodeURIComponent(postTitle)}`;
  }
});

async function carregarPosts() {
    try {
      const resposta = await fetch("/posts");
      const posts = await resposta.json();

      const container = document.getElementById("posts-container");
      container.innerHTML = "";

      posts.forEach(post => {
        const card = document.createElement("div");
        card.className = "post-card";
        card.innerHTML = `
          <h3>${post.titulo}</h3>
          <p>${post.conteudo}</p>
        `;
        container.appendChild(card);
      });

    } catch (erro) {
      console.error("Erro ao carregar posts:", erro);
    }
  }

  carregarPosts();

