import { useState, useEffect, useCallback } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, update, get } from "firebase/database";
import { firebaseConfig } from "./firebase.config";
import {
  makeDeck, shuffle, trickWinner, cardPoints, trickPoints,
  validCards, calcRoundScores, passTarget
} from "./gameLogic";

// ─── Firebase Init ────────────────────────────────────────────────────────────
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ─── Card Component ───────────────────────────────────────────────────────────
function CardUI({ card, selected, onClick, disabled, small, faceDown, announced }) {
  if (!card) return null;
  const isRed = card.suit === "♥" || card.suit === "♦";
  const isSpecial = card.isSpecial;
  const isAnnounced = announced && announced[card.id];

  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        width: small ? 46 : 62,
        height: small ? 68 : 92,
        borderRadius: 10,
        background: faceDown
          ? "linear-gradient(135deg,#1a3a2a,#0d2018)"
          : isSpecial
            ? card.id === "JOKER"
              ? "linear-gradient(135deg,#2a0a4a,#4a1a8a)"
              : "linear-gradient(135deg,#4a2a0a,#8a5a1a)"
            : "linear-gradient(160deg,#fffef5 80%,#f5f0e0)",
        border: selected
          ? "2.5px solid #ffd700"
          : isAnnounced
            ? "2.5px solid #ff6b35"
            : isSpecial
              ? "1.5px solid rgba(255,255,255,0.3)"
              : "1.5px solid #ccc",
        boxShadow: selected
          ? "0 0 16px rgba(255,215,0,0.9), 0 4px 12px rgba(0,0,0,0.5)"
          : isAnnounced
            ? "0 0 12px rgba(255,107,53,0.7)"
            : "0 3px 8px rgba(0,0,0,0.4)",
        cursor: disabled ? "default" : "pointer",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "3px 4px",
        transition: "transform 0.15s, box-shadow 0.15s",
        transform: selected ? "translateY(-14px)" : "translateY(0)",
        userSelect: "none",
        flexShrink: 0,
        position: "relative",
      }}
    >
      {faceDown ? (
        <div style={{
          position: "absolute", inset: 4, borderRadius: 6,
          background: "repeating-linear-gradient(45deg,#1d4530,#1d4530 4px,#153824 4px,#153824 8px)",
        }} />
      ) : isSpecial ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 4 }}>
          <div style={{ fontSize: small ? 18 : 26 }}>{card.suit}</div>
          <div style={{ color: "white", fontSize: small ? 8 : 11, fontWeight: 700, textAlign: "center", letterSpacing: 0.5 }}>{card.rank}</div>
          {isAnnounced && <div style={{ fontSize: 8, color: "#ff6b35" }}>معلن</div>}
        </div>
      ) : (
        <>
          <div style={{ fontSize: small ? 10 : 13, fontWeight: 700, color: isRed ? "#c0392b" : "#1a1a2e", lineHeight: 1.1 }}>
            {card.rank}<br />{card.suit}
          </div>
          <div style={{ fontSize: small ? 16 : 22, textAlign: "center", color: isRed ? "#c0392b" : "#1a1a2e" }}>
            {card.suit}
          </div>
          <div style={{ fontSize: small ? 10 : 13, fontWeight: 700, color: isRed ? "#c0392b" : "#1a1a2e", alignSelf: "flex-end", transform: "rotate(180deg)", lineHeight: 1.1 }}>
            {card.rank}<br />{card.suit}
          </div>
          {isAnnounced && (
            <div style={{ position: "absolute", top: 2, right: 2, background: "#ff6b35", borderRadius: 4, fontSize: 7, color: "white", padding: "1px 3px" }}>معلن</div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Screens ──────────────────────────────────────────────────────────────────
function HomeScreen({ onHost, onJoin }) {
  const [roomId, setRoomId] = useState("");
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at 30% 20%, #1a0a00 0%, #0d0500 50%, #000 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: 20, gap: 24,
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>🃏</div>
        <h1 style={{
          margin: 0, fontSize: "clamp(2rem,7vw,3.5rem)", fontWeight: 900,
          color: "#ffd700", textShadow: "0 0 40px rgba(255,215,0,0.5)",
          letterSpacing: 6, fontFamily: "Georgia, serif",
        }}>سبيته</h1>
        <p style={{ color: "#8a6a3a", margin: "8px 0 0", letterSpacing: 4, fontSize: "0.8rem" }}>SABITA • لعبة الورق</p>
      </div>

      <div style={{
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,215,0,0.2)",
        borderRadius: 20, padding: "28px 32px", width: "100%", maxWidth: 360,
        display: "flex", flexDirection: "column", gap: 16,
      }}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="اسمك"
          maxLength={12}
          style={inputStyle}
        />

        {!joining ? (
          <>
            <button onClick={() => name.trim() && onHost(name.trim())} style={btnGold} disabled={!name.trim()}>
              🏠 إنشاء غرفة جديدة
            </button>
            <button onClick={() => setJoining(true)} style={btnOutline}>
              🔗 الانضمام لغرفة
            </button>
          </>
        ) : (
          <>
            <input
              value={roomId}
              onChange={e => setRoomId(e.target.value.toUpperCase())}
              placeholder="كود الغرفة"
              maxLength={6}
              style={{ ...inputStyle, letterSpacing: 6, textAlign: "center", fontSize: "1.2rem" }}
            />
            <button onClick={() => name.trim() && roomId.length === 6 && onJoin(name.trim(), roomId)} style={btnGold} disabled={!name.trim() || roomId.length !== 6}>
              ✅ انضم
            </button>
            <button onClick={() => setJoining(false)} style={btnOutline}>← رجوع</button>
          </>
        )}
      </div>
    </div>
  );
}

function LobbyScreen({ room, roomId, myId, onStart }) {
  const players = Object.values(room.players || {});
  const isHost = players[0]?.id === myId;
  const teams = [
    players.filter((_, i) => i % 2 === 0),
    players.filter((_, i) => i % 2 === 1),
  ];

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at 30% 20%, #1a0a00 0%, #0d0500 50%, #000 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", padding: "30px 16px", gap: 20,
    }}>
      <h1 style={{ color: "#ffd700", fontFamily: "Georgia, serif", fontSize: "2rem", margin: 0 }}>🃏 سبيته</h1>

      <div style={{ background: "rgba(255,215,0,0.08)", border: "2px solid rgba(255,215,0,0.3)", borderRadius: 16, padding: "16px 32px", textAlign: "center" }}>
        <div style={{ color: "#8a6a3a", fontSize: "0.75rem", letterSpacing: 3, marginBottom: 4 }}>كود الغرفة</div>
        <div style={{ color: "#ffd700", fontSize: "2.5rem", fontWeight: 900, letterSpacing: 8 }}>{roomId}</div>
        <div style={{ color: "#8a6a3a", fontSize: "0.7rem" }}>شارك الكود مع أصحابك</div>
      </div>

      <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ color: "#8a6a3a", fontSize: "0.75rem", textAlign: "center", letterSpacing: 2 }}>
          اللاعبون ({players.length}/6) — الترتيب: خصم صديق خصم صديق خصم صديق
        </div>
        {players.map((p, i) => (
          <div key={p.id} style={{
            display: "flex", alignItems: "center", gap: 12,
            background: i % 2 === 0 ? "rgba(255,80,80,0.08)" : "rgba(80,200,80,0.08)",
            border: `1px solid ${i % 2 === 0 ? "rgba(255,80,80,0.2)" : "rgba(80,200,80,0.2)"}`,
            borderRadius: 12, padding: "10px 16px",
          }}>
            <div style={{ fontSize: "1.4rem" }}>{i % 2 === 0 ? "🔴" : "🟢"}</div>
            <div>
              <div style={{ color: "#e8d5a0", fontWeight: 700 }}>{p.name} {p.id === myId ? "(أنت)" : ""}</div>
              <div style={{ color: "#8a6a3a", fontSize: "0.7rem" }}>{i % 2 === 0 ? "الفريق الأحمر" : "الفريق الأخضر"} • مقعد {i + 1}</div>
            </div>
            {i === 0 && <div style={{ marginLeft: "auto", color: "#ffd700", fontSize: "0.75rem" }}>👑 المضيف</div>}
          </div>
        ))}
        {players.length < 6 && (
          <div style={{ color: "#8a6a3a", fontSize: "0.75rem", textAlign: "center" }}>
            في انتظار {6 - players.length} لاعب آخر...
          </div>
        )}
      </div>

      {isHost && players.length === 6 && (
        <button onClick={onStart} style={{ ...btnGold, maxWidth: 300, width: "100%", fontSize: "1.1rem", padding: "14px" }}>
          🚀 ابدأ اللعبة
        </button>
      )}
      {isHost && players.length < 6 && (
        <div style={{ color: "#8a6a3a", fontSize: "0.8rem" }}>انتظر حتى ينضم 6 لاعبين لتبدأ</div>
      )}
    </div>
  );
}

// ─── Main Game Screen ─────────────────────────────────────────────────────────
function GameScreen({ room, roomId, myId }) {
  const [selectedCards, setSelectedCards] = useState([]);
  const [passCards, setPassCards] = useState([]);
  const [announcing, setAnnouncing] = useState(false);

  const players = Object.values(room.players || {}).sort((a, b) => a.seat - b.seat);
  const me = players.find(p => p.id === myId);
  const myHand = (room.hands && room.hands[myId]) || [];
  const phase = room.phase; // 'passing' | 'announcing' | 'playing' | 'roundEnd' | 'gameEnd'
  const trick = room.trick || [];
  const announced = room.announced || {};
  const scores = room.scores || {};
  const leadSuit = room.leadSuit;
  const currentTurn = room.currentTurn;
  const isMyTurn = currentTurn === myId;

  const myPassDone = room.passed && room.passed[myId];
  const myAnnounceDone = room.announceDone && room.announceDone[myId];

  // ── Passing ──
  function togglePassCard(card) {
    if (passCards.find(c => c.id === card.id)) {
      setPassCards(passCards.filter(c => c.id !== card.id));
    } else if (passCards.length < 3) {
      setPassCards([...passCards, card]);
    }
  }

  async function submitPass() {
    if (passCards.length !== 3) return;
    const target = passTarget(me.seat, 6);
    const targetPlayer = players[target];
    await update(ref(db, `rooms/${roomId}`), {
      [`passed/${myId}`]: true,
      [`passedCards/${myId}`]: passCards,
      [`passTarget/${myId}`]: targetPlayer.id,
    });
    // Check if all passed
    const snap = await get(ref(db, `rooms/${roomId}/passed`));
    const passedAll = snap.val() && Object.keys(snap.val()).length === 6;
    if (passedAll) {
      // Apply passes
      const psSnap = await get(ref(db, `rooms/${roomId}/passedCards`));
      const ptSnap = await get(ref(db, `rooms/${roomId}/passTarget`));
      const passedCards = psSnap.val();
      const passTargets = ptSnap.val();
      const handsSnap = await get(ref(db, `rooms/${roomId}/hands`));
      const hands = handsSnap.val();
      // Remove passed cards from senders, add to receivers
      const newHands = { ...hands };
      for (const senderId of Object.keys(passedCards)) {
        const receiverId = passTargets[senderId];
        const cards = passedCards[senderId];
        newHands[senderId] = newHands[senderId].filter(c => !cards.find(x => x.id === c.id));
        newHands[receiverId] = [...(newHands[receiverId] || []), ...cards];
      }
      await update(ref(db, `rooms/${roomId}`), {
        hands: newHands,
        phase: "announcing",
        announceDone: {},
      });
    }
    setPassCards([]);
  }

  // ── Announcing ──
  async function submitAnnounce(cardIds) {
    const newAnnounced = { ...announced };
    for (const id of cardIds) newAnnounced[id] = true;
    await update(ref(db, `rooms/${roomId}`), {
      [`announceDone/${myId}`]: true,
      announced: newAnnounced,
    });
    setAnnouncing(false);
    // Check if all announced
    const snap = await get(ref(db, `rooms/${roomId}/announceDone`));
    if (snap.val() && Object.keys(snap.val()).length === 6) {
      await update(ref(db, `rooms/${roomId}`), { phase: "playing" });
    }
  }

  // ── Playing ──
  async function playCard(card) {
    if (!isMyTurn || phase !== "playing") return;
    const valid = validCards(myHand, trick, leadSuit);
    if (!valid.find(c => c.id === card.id)) return;

    const newTrick = [...trick, { playerId: myId, card }];
    const newHand = myHand.filter(c => c.id !== card.id);
    const newLeadSuit = trick.length === 0 ? card.suit : leadSuit;

    if (newTrick.length === 6) {
      // Trick complete
      const winnerId = trickWinner(newTrick, newLeadSuit);
      const winnerSnap = await get(ref(db, `rooms/${roomId}/piles/${winnerId}`));
      const winnerPile = winnerSnap.val() || [];
      const newPile = [...winnerPile, ...newTrick.map(t => t.card)];

      // Check if round over
      const allHandsSnap = await get(ref(db, `rooms/${roomId}/hands`));
      const allHands = allHandsSnap.val();
      allHands[myId] = newHand;
      const roundOver = Object.values(allHands).every(h => h.length === 0);

      if (roundOver) {
        // Calc scores
        const pilesSnap = await get(ref(db, `rooms/${roomId}/piles`));
        const piles = pilesSnap.val() || {};
        piles[winnerId] = newPile;
        const roundScores = calcRoundScores(piles, announced, players);
        const currentScores = scores;
        const newScores = {};
        for (const p of players) {
          newScores[p.id] = (currentScores[p.id] || 0) + (roundScores[p.id] || 0);
        }
        const gameOver = Object.values(newScores).some(s => s >= 360);
        await update(ref(db, `rooms/${roomId}`), {
          trick: [],
          leadSuit: null,
          piles: {},
          [`hands/${myId}`]: newHand,
          [`piles/${winnerId}`]: newPile,
          scores: newScores,
          lastRoundScores: roundScores,
          phase: gameOver ? "gameEnd" : "roundEnd",
          currentTurn: winnerId,
        });
      } else {
        // Next trick - winner leads
        const nextSeat = (players.findIndex(p => p.id === winnerId));
        await update(ref(db, `rooms/${roomId}`), {
          trick: [],
          leadSuit: null,
          [`hands/${myId}`]: newHand,
          [`piles/${winnerId}`]: newPile,
          currentTurn: winnerId,
          lastTrickWinner: winnerId,
        });
      }
    } else {
      // Next player (counter-clockwise = seat - 1)
      const myIdx = players.findIndex(p => p.id === myId);
      const nextIdx = (myIdx - 1 + 6) % 6;
      const nextPlayer = players[nextIdx];
      await update(ref(db, `rooms/${roomId}`), {
        trick: newTrick,
        leadSuit: newLeadSuit,
        [`hands/${myId}`]: newHand,
        currentTurn: nextPlayer.id,
      });
    }
  }

  async function nextRound() {
    const deck = shuffle(makeDeck());
    const hands = {};
    players.forEach((p, i) => { hands[p.id] = deck.slice(i * 9, i * 9 + 9); });
    // Dealer: player with most points, next on right starts
    const maxScore = Math.max(...players.map(p => scores[p.id] || 0));
    const richest = players.find(p => (scores[p.id] || 0) === maxScore);
    const richIdx = players.findIndex(p => p.id === richest.id);
    const starterIdx = (richIdx + 1) % 6;
    await update(ref(db, `rooms/${roomId}`), {
      hands,
      trick: [],
      leadSuit: null,
      piles: {},
      passed: {},
      passedCards: {},
      passTarget: {},
      announced: {},
      announceDone: {},
      phase: "passing",
      currentTurn: players[starterIdx].id,
      lastRoundScores: null,
    });
    setPassCards([]);
  }

  // ── Announce candidates in my hand ──
  const announceable = myHand.filter(c =>
    c.id === "JOKER" || c.id === "MIKER" || c.isQueenSpades || c.isTenDiamonds
  );
  const [announceSelected, setAnnounceSelected] = useState([]);

  // ── Valid cards highlight ──
  const valid = phase === "playing" && isMyTurn
    ? validCards(myHand, trick, leadSuit).map(c => c.id)
    : [];

  const lastRound = room.lastRoundScores;

  // ── Render ──
  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at 20% 10%, #1a0800 0%, #080300 60%, #000 100%)",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "10px 8px", gap: 8, fontFamily: "Georgia, serif",
    }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
        @keyframes slideUp { from{transform:translateY(20px);opacity:0} to{transform:translateY(0);opacity:1} }
      `}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, width: "100%", maxWidth: 500 }}>
        <h2 style={{ color: "#ffd700", margin: 0, fontSize: "1.3rem", flex: 1 }}>🃏 سبيته</h2>
        <div style={{ color: "#8a6a3a", fontSize: "0.7rem" }}>غرفة: {roomId}</div>
      </div>

      {/* Scores */}
      <div style={{
        display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center",
        width: "100%", maxWidth: 500,
      }}>
        {players.map((p, i) => (
          <div key={p.id} style={{
            background: p.id === myId ? "rgba(255,215,0,0.12)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${i % 2 === 0 ? "rgba(255,80,80,0.3)" : "rgba(80,200,80,0.3)"}`,
            borderRadius: 10, padding: "5px 10px", textAlign: "center", minWidth: 70,
          }}>
            <div style={{ fontSize: "0.65rem", color: i % 2 === 0 ? "#ff8080" : "#80ff80" }}>
              {i % 2 === 0 ? "🔴" : "🟢"} {p.name} {p.id === myId ? "★" : ""}
            </div>
            <div style={{ color: "#ffd700", fontWeight: 700, fontSize: "1rem" }}>{scores[p.id] || 0}</div>
            {currentTurn === p.id && phase === "playing" && (
              <div style={{ fontSize: "0.6rem", color: "#ffd700", animation: "pulse 1s infinite" }}>دوره ▶</div>
            )}
          </div>
        ))}
      </div>

      {/* ── PASSING PHASE ── */}
      {phase === "passing" && !myPassDone && (
        <div style={phaseBox}>
          <div style={phaseTitle}>📤 اختر 3 أوراق لترحيلها يساراً</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
            {myHand.map(c => (
              <CardUI
                key={c.id} card={c}
                selected={!!passCards.find(x => x.id === c.id)}
                onClick={() => togglePassCard(c)}
                announced={announced}
              />
            ))}
          </div>
          <div style={{ color: "#8a6a3a", fontSize: "0.8rem" }}>محدد: {passCards.length}/3</div>
          <button onClick={submitPass} style={btnGold} disabled={passCards.length !== 3}>
            ✅ ترحيل الأوراق
          </button>
        </div>
      )}
      {phase === "passing" && myPassDone && (
        <div style={phaseBox}>
          <div style={{ color: "#7fc97f", fontSize: "1rem" }}>✅ تم الترحيل، في انتظار الآخرين...</div>
        </div>
      )}

      {/* ── ANNOUNCING PHASE ── */}
      {phase === "announcing" && !myAnnounceDone && (
        <div style={phaseBox}>
          <div style={phaseTitle}>📢 الإعلان (اختياري)</div>
          <div style={{ color: "#8a6a3a", fontSize: "0.75rem", marginBottom: 8 }}>
            الإعلان يضاعف نقاط الورقة — هل تعلن؟
          </div>
          {announceable.length > 0 ? (
            <>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                {announceable.map(c => (
                  <div key={c.id} onClick={() => {
                    if (announceSelected.includes(c.id)) setAnnounceSelected(announceSelected.filter(x => x !== c.id));
                    else setAnnounceSelected([...announceSelected, c.id]);
                  }}>
                    <CardUI card={c} selected={announceSelected.includes(c.id)} announced={announced} />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => submitAnnounce(announceSelected)} style={btnGold}>
                  📢 أعلن المحدد
                </button>
                <button onClick={() => submitAnnounce([])} style={btnOutline}>
                  تخطي
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ color: "#8a6a3a" }}>ليس لديك أوراق للإعلان</div>
              <button onClick={() => submitAnnounce([])} style={btnGold}>متابعة ▶</button>
            </>
          )}
        </div>
      )}
      {phase === "announcing" && myAnnounceDone && (
        <div style={phaseBox}>
          <div style={{ color: "#7fc97f" }}>✅ تم، في انتظار الآخرين...</div>
        </div>
      )}

      {/* ── PLAYING PHASE ── */}
      {phase === "playing" && (
        <>
          {/* Table / Trick */}
          <div style={{
            background: "radial-gradient(ellipse,#1a7a42 0%,#0d5c2f 60%,#07391d 100%)",
            border: "3px solid #5a3a1a", borderRadius: 18,
            padding: "12px 10px", width: "100%", maxWidth: 500,
            minHeight: 100, display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
          }}>
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: "0.65rem", letterSpacing: 3 }}>— الطاولة —</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              {trick.map((t, i) => {
                const p = players.find(x => x.id === t.playerId);
                return (
                  <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                    <CardUI card={t.card} disabled small announced={announced} />
                    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.6rem" }}>{p?.name}</div>
                  </div>
                );
              })}
              {trick.length === 0 && <div style={{ color: "rgba(255,255,255,0.2)", fontSize: "0.8rem", padding: "20px 0" }}>الطاولة فارغة</div>}
            </div>
          </div>

          {/* My hand */}
          <div style={{ width: "100%", maxWidth: 500 }}>
            <div style={{ color: "#8a6a3a", fontSize: "0.7rem", textAlign: "center", marginBottom: 6 }}>
              {isMyTurn ? "🟡 دورك! العب ورقة" : "دور " + players.find(p => p.id === currentTurn)?.name}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
              {myHand.map(c => (
                <CardUI
                  key={c.id} card={c}
                  onClick={() => playCard(c)}
                  disabled={!isMyTurn || !valid.includes(c.id)}
                  selected={selectedCards.includes(c.id)}
                  announced={announced}
                />
              ))}
            </div>
            {isMyTurn && valid.length === 0 && myHand.length > 0 && (
              <div style={{ color: "#ff8080", fontSize: "0.75rem", textAlign: "center", marginTop: 6 }}>
                يمكنك لعب أي ورقة
              </div>
            )}
          </div>
        </>
      )}

      {/* ── ROUND END ── */}
      {(phase === "roundEnd" || phase === "gameEnd") && (
        <div style={{ ...phaseBox, maxWidth: 420, width: "100%", animation: "slideUp 0.4s ease" }}>
          <div style={phaseTitle}>{phase === "gameEnd" ? "🏆 انتهت اللعبة!" : "🎴 نهاية الجولة"}</div>
          {lastRound && (
            <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 6 }}>
              {players.map((p, i) => (
                <div key={p.id} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "8px 14px",
                  border: `1px solid ${i % 2 === 0 ? "rgba(255,80,80,0.2)" : "rgba(80,200,80,0.2)"}`,
                }}>
                  <div style={{ color: "#e8d5a0" }}>{i % 2 === 0 ? "🔴" : "🟢"} {p.name}</div>
                  <div style={{ display: "flex", gap: 16 }}>
                    <div style={{ color: "#ff8080", fontSize: "0.85rem" }}>+{lastRound[p.id] || 0}</div>
                    <div style={{ color: "#ffd700", fontWeight: 700 }}>{scores[p.id] || 0}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {phase === "gameEnd" && (
            <div style={{ color: "#ffd700", fontWeight: 700, fontSize: "1.1rem", textAlign: "center" }}>
              الفائز: {players.reduce((a, b) => (scores[a.id] || 0) < (scores[b.id] || 0) ? a : b).name} 🥇
            </div>
          )}
          {phase === "roundEnd" && myId === players[0]?.id && (
            <button onClick={nextRound} style={btnGold}>▶ الجولة التالية</button>
          )}
          {phase === "roundEnd" && myId !== players[0]?.id && (
            <div style={{ color: "#8a6a3a", fontSize: "0.8rem" }}>في انتظار المضيف لبدء الجولة...</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const inputStyle = {
  background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,215,0,0.2)",
  borderRadius: 12, padding: "12px 16px", color: "#e8d5a0", fontSize: "1rem",
  outline: "none", width: "100%", boxSizing: "border-box", textAlign: "right",
  fontFamily: "Georgia, serif",
};
const btnGold = {
  background: "linear-gradient(135deg,#ffd700,#f0a500)", border: "none",
  borderRadius: 12, padding: "12px 24px", color: "#1a0a00",
  fontWeight: 700, fontSize: "1rem", cursor: "pointer",
  boxShadow: "0 4px 16px rgba(255,215,0,0.4)", fontFamily: "Georgia, serif",
  width: "100%",
};
const btnOutline = {
  background: "transparent", border: "1px solid rgba(255,215,0,0.3)",
  borderRadius: 12, padding: "12px 24px", color: "#ffd700",
  fontWeight: 600, fontSize: "0.95rem", cursor: "pointer",
  fontFamily: "Georgia, serif", width: "100%",
};
const phaseBox = {
  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,215,0,0.2)",
  borderRadius: 18, padding: "20px 16px", width: "100%", maxWidth: 500,
  display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
};
const phaseTitle = {
  color: "#ffd700", fontWeight: 700, fontSize: "1.1rem", textAlign: "center",
};

// ─── Root App ─────────────────────────────────────────────────────────────────
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function App() {
  const [screen, setScreen] = useState("home"); // home | lobby | game
  const [roomId, setRoomId] = useState(null);
  const [myId, setMyId] = useState(null);
  const [room, setRoom] = useState(null);

  useEffect(() => {
    if (!roomId) return;
    const roomRef = ref(db, `rooms/${roomId}`);
    const unsub = onValue(roomRef, snap => {
      const data = snap.val();
      if (data) {
        setRoom(data);
        if (data.phase && data.phase !== "lobby") setScreen("game");
        else setScreen("lobby");
      }
    });
    return () => unsub();
  }, [roomId]);

  async function hostRoom(name) {
    const id = generateRoomId();
    const playerId = `p_${Date.now()}`;
    const deck = shuffle(makeDeck());
    setMyId(playerId);
    setRoomId(id);
    await set(ref(db, `rooms/${id}`), {
      phase: "lobby",
      players: {
        [playerId]: { id: playerId, name, seat: 0 },
      },
      scores: {},
      trick: [],
      leadSuit: null,
      announced: {},
    });
  }

  async function joinRoom(name, id) {
    const snap = await get(ref(db, `rooms/${id}`));
    const data = snap.val();
    if (!data) return alert("الغرفة غير موجودة!");
    const existing = Object.values(data.players || {});
    if (existing.length >= 6) return alert("الغرفة ممتلئة!");
    const playerId = `p_${Date.now()}`;
    setMyId(playerId);
    setRoomId(id);
    await update(ref(db, `rooms/${id}/players`), {
      [playerId]: { id: playerId, name, seat: existing.length },
    });
  }

  async function startGame() {
    const players = Object.values(room.players).sort((a, b) => a.seat - b.seat);
    const deck = shuffle(makeDeck());
    // 54 cards / 6 players = 9 cards each
    const hands = {};
    players.forEach((p, i) => { hands[p.id] = deck.slice(i * 9, i * 9 + 9); });
    await update(ref(db, `rooms/${roomId}`), {
      hands,
      phase: "passing",
      trick: [],
      leadSuit: null,
      piles: {},
      passed: {},
      passedCards: {},
      passTarget: {},
      announced: {},
      announceDone: {},
      scores: Object.fromEntries(players.map(p => [p.id, 0])),
      currentTurn: players[0].id,
    });
  }

  if (screen === "home") return <HomeScreen onHost={hostRoom} onJoin={joinRoom} />;
  if (screen === "lobby" && room) return <LobbyScreen room={room} roomId={roomId} myId={myId} onStart={startGame} />;
  if (screen === "game" && room) return <GameScreen room={room} roomId={roomId} myId={myId} />;
  return <div style={{ color: "white", textAlign: "center", padding: 40 }}>جاري التحميل...</div>;
}
