const contactCard = document.getElementById('contactCard');
const seasonOrnament = document.getElementById('seasonOrnament');
const seasonButtons = document.querySelectorAll('[data-season-choice]');

function setSeason(season) {
  document.documentElement.dataset.season = season;
  contactCard.dataset.season = season;
  seasonOrnament.innerHTML = season === 'muertos'
    ? '🌼 <span>🕯️</span> 🌼'
    : '🦇 <span>✦</span> 🎃';
  seasonButtons.forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.seasonChoice === season));
  });
}

const today = new Date();
const isDayOfTheDead = today.getMonth() === 10 && (today.getDate() === 1 || today.getDate() === 2);
setSeason(isDayOfTheDead ? 'muertos' : 'halloween');

seasonButtons.forEach((button) => {
  button.addEventListener('click', () => setSeason(button.dataset.seasonChoice));
});