// ─── Constants ───────────────────────────────────────────────────────────────
export const SUITS = ['♠', '♥', '♦', '♣'];
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

// Special cards
export const JOKER = { id: 'JOKER', rank: 'جيكر', suit: '🃏', isSpecial: true, display: 'جيكر' };
export const MIKER = { id: 'MIKER', rank: 'ميكر', suit: '👑', isSpecial: true, display: 'ميكر' };

// Point values
export const CARD_POINTS = {
  'JOKER': 20,
  'MIKER': 15,
  'Q♠': 15,
  '10♦': 10,
};
export const HEART_POINT = 1;

// ─── Deck ────────────────────────────────────────────────────────────────────
export function makeDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${rank}${suit}`,
        rank,
        suit,
        isSpecial: false,
        isHeart: suit === '♥',
        isQueenSpades: rank === 'Q' && suit === '♠',
        isTenDiamonds: rank === '10' && suit === '♦',
      });
    }
  }
  deck.push({ ...JOKER });
  deck.push({ ...MIKER });
  return deck;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Card Power ──────────────────────────────────────────────────────────────
// Returns numeric power for comparison
export function cardPower(card, leadSuit) {
  if (card.id === 'JOKER') return 10000;
  if (card.id === 'MIKER') return 9999;

  const rankOrder = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 };

  // Hearts special order: 2<3<...<K < MIKER(9999) < A < JOKER(10000)
  if (card.suit === '♥') {
    if (card.rank === 'A') return 9998; // A♥ beats everything except MIKER/JOKER
    return rankOrder[card.rank];
  }

  // Non-heart, non-lead suit = 0 (can't win)
  if (card.suit !== leadSuit) return -1;

  return rankOrder[card.rank];
}

// ─── Trick Winner ────────────────────────────────────────────────────────────
export function trickWinner(trick, leadSuit) {
  // trick = [{playerId, card}, ...]
  let best = trick[0];
  for (const play of trick.slice(1)) {
    const bp = cardPower(best.card, leadSuit);
    const cp = cardPower(play.card, leadSuit);
    if (cp > bp) best = play;
  }
  return best.playerId;
}

// ─── Points ──────────────────────────────────────────────────────────────────
export function cardPoints(card, announced) {
  const base = card.isHeart ? 1
    : card.id === 'JOKER' ? 20
    : card.id === 'MIKER' ? 15
    : card.isQueenSpades ? 15
    : card.isTenDiamonds ? 10
    : 0;
  const isAnnounced = announced && announced[card.id];
  return isAnnounced ? base * 2 : base;
}

export function trickPoints(cards, announced) {
  return cards.reduce((sum, c) => sum + cardPoints(c, announced), 0);
}

// ─── Passing ─────────────────────────────────────────────────────────────────
// Counter-clockwise = pass to left (index - 1, wrap)
export function passTarget(playerIndex, totalPlayers) {
  return (playerIndex - 1 + totalPlayers) % totalPlayers;
}

// ─── Valid plays ─────────────────────────────────────────────────────────────
export function validCards(hand, trick, leadSuit) {
  // Hearts can always be played
  if (trick.length === 0) return hand; // lead: any card
  const mustFollow = hand.filter(c => c.suit === leadSuit && !c.isSpecial);
  if (mustFollow.length > 0) {
    // Must follow suit, but can also play hearts or specials
    const hearts = hand.filter(c => c.isHeart || c.isSpecial);
    return [...mustFollow, ...hearts];
  }
  return hand; // no cards of lead suit → play anything
}

// ─── Scoring end of round ────────────────────────────────────────────────────
export function calcRoundScores(playerPiles, announced, players) {
  const scores = {};
  for (const p of players) scores[p.id] = 0;

  // 1. Tally raw points per player
  const raw = {};
  for (const p of players) {
    raw[p.id] = trickPoints(playerPiles[p.id] || [], announced);
  }

  // 2. Find MIKER = player with most heart points (hearts only)
  const heartPoints = {};
  for (const p of players) {
    heartPoints[p.id] = (playerPiles[p.id] || [])
      .filter(c => c.isHeart)
      .reduce((s, c) => s + cardPoints(c, announced), 0);
  }
  const maxHearts = Math.max(...Object.values(heartPoints));
  const mikerPlayers = players.filter(p => heartPoints[p.id] === maxHearts);
  const mikerId = mikerPlayers[0].id; // first if tie

  // 3. Find who has A♥ (Joker in hearts = transfers miker points)
  let aHeartHolder = null;
  for (const p of players) {
    if ((playerPiles[p.id] || []).some(c => c.rank === 'A' && c.suit === '♥')) {
      aHeartHolder = p.id;
    }
  }

  // 4. Assign scores
  for (const p of players) {
    scores[p.id] = raw[p.id];
  }

  // 5. Transfer miker's heart points to A♥ holder
  if (aHeartHolder && aHeartHolder !== mikerId) {
    const mikerHearts = heartPoints[mikerId];
    scores[mikerId] -= mikerHearts;
    scores[aHeartHolder] += mikerHearts;
  }

  return scores;
}
