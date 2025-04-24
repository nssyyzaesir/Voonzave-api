// Elementos do DOM
const chatButton = document.getElementById('chat-button');
const chatModal = document.getElementById('chat-modal');
const closeModal = document.getElementById('close-modal');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const sendButton = document.getElementById('send-button');

// Variáveis de estado
let conversationHistory = [
  { role: "system", content: "Você é NEXUS AI, um assistente de IA avançado com personalidade futurista. Use linguagem técnica, mas acessível. Faça referências ocasionais a tecnologia avançada em suas respostas. Mantenha suas respostas concisas, mas informativas." }
];

// Adicionar grade tecnológica ao body
const techGrid = document.createElement('div');
techGrid.classList.add('technology-grid');
document.body.appendChild(techGrid);

// Event Listeners
chatButton.addEventListener('click', () => {
  chatModal.classList.add('active');
  setTimeout(() => {
    chatInput.focus();
  }, 500);
});

closeModal.addEventListener('click', () => {
  chatModal.classList.remove('active');
});

// Fechar modal ao clicar fora dele
chatModal.addEventListener('click', (e) => {
  if (e.target === chatModal) {
    chatModal.classList.remove('active');
  }
});

// Enviar mensagem quando Enter for pressionado
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && chatInput.value.trim() !== '') {
    e.preventDefault();
    sendMessage();
  }
});

// Botão de enviar
sendButton.addEventListener('click', () => {
  if (chatInput.value.trim() !== '') {
    sendMessage();
  }
});

// Funções
function sendMessage() {
  const userMessage = chatInput.value.trim();
  
  // Limpar input
  chatInput.value = '';
  
  // Adicionar mensagem do usuário ao chat
  addMessageToChat('user', userMessage);
  
  // Adicionar à história da conversa
  conversationHistory.push({ role: "user", content: userMessage });
  
  // Mostrar indicador de digitação
  addTypingIndicator();
  
  // Enviar para a API e obter resposta
  getAIResponse(userMessage);
}

function addMessageToChat(sender, message) {
  const messageDiv = document.createElement('div');
  messageDiv.classList.add('message', sender);
  
  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  messageDiv.innerHTML = `
    <div class="message-bubble">
      <div class="message-content">
        <p>${message}</p>
      </div>
      <div class="timestamp">${timestamp}</div>
    </div>
  `;
  
  chatMessages.appendChild(messageDiv);
  scrollToBottom();
}

function addTypingIndicator() {
  const loadingDiv = document.createElement('div');
  loadingDiv.classList.add('message', 'ai', 'loading');
  loadingDiv.id = 'typing-indicator';
  
  loadingDiv.innerHTML = `
    <div class="message-bubble">
      <div class="message-content">
        <p>Processando sua ideia nos meus circuitos de última geração</p>
      </div>
      <div class="typing-indicator">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  `;
  
  chatMessages.appendChild(loadingDiv);
  scrollToBottom();
}

function removeTypingIndicator() {
  const indicator = document.getElementById('typing-indicator');
  if (indicator) {
    indicator.remove();
  }
}

function scrollToBottom() {
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function getAIResponse(userMessage) {
  try {
    // Chamada para API do OpenAI
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: conversationHistory
      })
    });

    if (!response.ok) {
      throw new Error(`Erro na API: ${response.status}`);
    }

    const data = await response.json();
    const aiMessage = data.response;
    
    // Adicionar à história da conversa
    conversationHistory.push({ role: "assistant", content: aiMessage });
    
    // Remover indicador de digitação
    removeTypingIndicator();
    
    // Adicionar resposta da IA ao chat com efeito de digitação
    setTimeout(() => {
      addMessageToChat('ai', aiMessage);
    }, 500);
    
  } catch (error) {
    console.error('Erro ao obter resposta da IA:', error);
    
    // Remover indicador de digitação
    removeTypingIndicator();
    
    // Adicionar mensagem de erro ao chat
    setTimeout(() => {
      addMessageToChat('system', 'Falha na comunicação com os satélites. Tente novamente.');
    }, 500);
  }
}

// Inicializa os efeitos visuais
function initVisualEffects() {
  // Simular um scanner aleatório de fundo
  setInterval(() => {
    const scanLines = document.querySelectorAll('.scan-line');
    scanLines.forEach(line => {
      line.style.opacity = Math.random() > 0.7 ? '0.8' : '0.3';
      line.style.width = `${30 + Math.random() * 50}px`;
    });
  }, 2000);
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  initVisualEffects();
});