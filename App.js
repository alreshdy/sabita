import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, onValue, update, get } from "firebase/database";
import { firebaseConfig } from "./firebase.config";
import {
  makeDeck, shuffle, trickWinner, calcRoundScores, passTarget, validCards
} from "./gameLogic";

// ─── Firebase Init ────────────────────────────────────────────────────────────
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ─── نظام المؤثرات الصوتية الملكي (VIP Audio Engine) ─────────────────────────
const playVIPSound = (type) => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const audioCtx = new AudioContext();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    if (type === "card_play") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(320, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(70, audioCtx.currentTime + 0.15);
      gainNode.gain.setValueAtTime(0.25, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } else if (type === "trick_win") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, audioCtx.currentTime);
      osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } else if (type === "shuffle") {
      for (let i = 0; i < 7; i++) {
        const timeOffset = i * 0.07;
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.connect(g);
        g.connect(audioCtx.destination);
        o.type = "sawtooth";
        o.frequency.setValueAtTime(140 + (i * 35), audioCtx.currentTime + timeOffset);
        g.gain.setValueAtTime(0.06, audioCtx.currentTime + timeOffset);
        g.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + timeOffset + 0.05);
        o.start(audioCtx.currentTime + timeOffset);
        o.stop(audioCtx.currentTime + timeOffset + 0.05);
      }
    }
  } catch (e) {
    console.log("Audio error:", e);
  }
};

// ─── Card Component ───────────────────────────────────────────────────────────
function CardUI({ card, selected, onClick, disabled, small, faceDown, announced }) {
  if (!card) return null;
  const isRed = card.suit === "♥" || card.suit === "♦";
  const isSpecial = card.isSpecial || card.id === "JOKER" || card.id === "MIKER";
  const isAnnounced = announced && announced[card.id];

  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        width: small ? 46 : 64,
        height: small ? 68 : 94,
        borderRadius: 10,
        background: faceDown
          ? "linear-gradient(135deg, #8a1616, #400404)"
          : isSpecial
            ? "linear-gradient(135deg, #192a56, #273c75)"
            : "linear-gradient(160deg, #ffffff 85%, #f5f6fa)",
        border: selected
          ? "3px solid #ffca28"
          : isAnnounced
            ? "2.5px solid #e17055"
            : "1.5px solid #dcdde1",
        boxShadow: selected
          ? "0 0 15px rgba(255,202,40,0.85), 0 4px 10px rgba(0,0,0,0.6)"
          : "0 3px 6px rgba(0,0,0,0.35)",
        cursor: disabled ? "default" : "pointer",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "5px 6px",
        transition: "all 0.15s ease-in-out",
        transform: selected ? "translateY(-10px) scale(1.03)" : "translateY(0)",
        userSelect: "none",
        flexShrink: 0,
        position: "relative",
      }}
    >
      {faceDown ? (
        <div style={{
          position: "absolute", inset: 4, borderRadius: 6,
          border: "1px solid rgba(255,215,0,0.25)",
          background: "repeating-linear-gradient(45deg, #5c0606, #5c0606 3px, #360202 3px, #360202 6px)",
        }} />
      ) : (
        <>
          <div style={{ fontSize: small ? 10 : 12, fontWeight: 700, color: isRed ? "#c23616" : "#2f3640", lineHeight: 1.1, textAlign: "right" }}>
            {card.rank}<br />{card.suit}
          </div>
          <div style={{ fontSize: small ? 16 : 20, textAlign: "center", color: isRed ? "#c23616" : "#2f3640" }}>
            {card.suit}
          </div>
          <div style={{ fontSize: small ? 10 : 12, fontWeight: 700, color: isRed ? "#c23616" : "#2f3640", alignSelf: "flex-end", transform: "rotate(180deg)", lineHeight: 1.1 }}>
            {card.rank}<br />{card.suit}
          </div>
        </>
      )}
    </div>
  );
}

// ─── HomeScreen ────────────────────────────────────────────────────────────
function HomeScreen({ onHost, onJoin }) {
  const [roomId, setRoomId] = useState("");
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(circle at center, #1b262c 0%, #0f171e 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
      padding: "50px 20px", boxSizing: "border-box", direction: "rtl"
    }}>
      <div />
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 65, marginBottom: 5, filter: "drop-shadow(0 4px 8px rgba(255,215,0,0.3))" }}>🏆</div>
        <h1 style={{
          margin: 0, fontSize: "clamp(2.5rem, 6.5vw, 3.6rem)", fontWeight: 900,
          background: "linear-gradient(135deg, #ffe066 0%, #f5b041 50%, #c97924 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>لعبة السبيته</h1>
        <p style={{ color: "#7f8c8d", margin: "6px 0 0", fontSize: "0.85rem", fontWeight: "600" }}>
          برعاية <span style={{ color: "#f5b041", fontWeight: "800" }}>good guys group</span>
        </p>
      </div>

      <div style={{
        background: "rgba(255,255,255,0.02)", border: "2px solid #d4af37",
        borderRadius: 20, padding: "35px 25px", width: "100%", maxWidth: 390,
        display: "flex", flexDirection: "column", gap: 16, backdropFilter: "blur(15px)",
      }}>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="👤 أدخل اسمك هنا..."
          maxLength={12}
          style={inputStyle}
        />

        {!joining ? (
          <>
            <button onClick={() => name.trim() && onHost(name.trim())} style={btnGold} disabled={!name.trim()}>
              👑 إنشاء مجلس جديد (VIP)
            </button>
            <button onClick={() => setJoining(true)} style={btnOutline}>
              💬 انضمام لجلسة سابقة
            </button>
          </>
        ) : (
          <>
            <input
              value={roomId}
              onChange={e => setRoomId(e.target.value.toUpperCase())}
              placeholder="كود الدخول"
              maxLength={6}
              style={{ ...inputStyle, letterSpacing: 5, textAlign: "center", fontSize: "1.2rem", fontWeight: "700" }}
            />
            <button onClick={() => name.trim() && roomId.length === 6 && onJoin(name.trim(), roomId)} style={btnGold} disabled={!name.trim() || roomId.length !== 6}>
              ♦ دخول الجلسة الآن
            </button>
            <button onClick={() => setJoining(false)} style={btnOutline}>تراجع</button>
          </>
        )}
      </div>
      <div style={{ color: "rgba(212,175,55,0.6)", fontSize: "0.8rem", fontFamily: "monospace" }}>برمجة alreshdy</div>
    </div>
  );
}

// ─── LobbyScreen ──────────────────────────────────────────────────────────────
function LobbyScreen({ room, roomId, myId, onStart }) {
  const players = Object.values(room.players || {});
  const isHost = players[0]?.id === myId;

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(circle at center, #1b262c 0%, #0f171e 100%)",
      display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 20px", gap: 20, direction: "rtl"
    }}>
      <h1 style={{ color: "#f5b041", fontSize: "1.9rem", margin: 0, fontWeight: "900" }}>مجلس السبيته VIP</h1>
      <div style={{ background: "rgba(212,175,55,0.04)", border: "1px solid #d4af37", borderRadius: 16, padding: "15px 35px", textAlign: "center" }}>
        <div style={{ color: "#ffe066", fontSize: "2.2rem", fontWeight: 900, letterSpacing: 4 }}>{roomId}</div>
      </div>

      <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 12 }}>
        {players.map((p, i) => (
          <div key={p.id} style={{
            display: "flex", alignItems: "center", gap: 12,
            background: "rgba(255,255,255,0.02)", border: "1px solid rgba(212,175,55,0.2)", borderRadius: 12, padding: "12px 18px",
          }}>
            <div style={{ color: "#ffffff", fontWeight: 700 }}>{p.name} {p.id === myId ? "(أنت)" : ""}</div>
          </div>
        ))}
      </div>

      {isHost && players.length === 6 && (
        <button onClick={onStart} style={btnGold}>🚀 ابدأ اللعبة الآن</button>
      )}
    </div>
  );
}

// ─── Main Game Screen ─────────────────────────────────────────────────────────
function GameScreen({ room, roomId, myId }) {
  const [passCards, setPassCards] = useState([]);
  const players = Object.values(room.players || {}).sort((a, b) => a.seat - b.seat);
  const me = players.find(p => p.id === myId) || { id: myId, name: "لاعب", seat: 0 };
  const myHand = (room.hands && room.hands[myId]) || [];
  const phase = room.phase; 
  const trick = room.trick || [];
  const announced = room.announced || {};
  const scores = room.scores || {};
  const leadSuit = room.leadSuit;
  const currentTurn = room.currentTurn;
  const dealerId = room.dealerId || players[0]?.id; 
  const isMyTurn = currentTurn === myId;

  const myPassDone = room.passed && room.passed[myId];
  const myAnnounceDone = room.announceDone && room.announceDone[myId];

  const prevTrickLength = useRef(trick.length);
  useEffect(() => {
    if (trick.length > prevTrickLength.current) { playVIPSound("card_play"); }
    prevTrickLength.current = trick.length;
  }, [trick]);

  useEffect(() => { if (phase === "passing") { playVIPSound("shuffle"); } }, [phase]);

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
    
    const snap = await get(ref(db, `rooms/${roomId}/passed`));
    if (snap.val() && Object.keys(snap.val()).length === 6) {
      const psSnap = await get(ref(db, `rooms/${roomId}/passedCards`));
      const ptSnap = await get(ref(db, `rooms/${roomId}/passTarget`));
      const pCards = psSnap.val();
      const pTargets = ptSnap.val();
      const handsSnap = await get(ref(db, `rooms/${roomId}/hands`));
      const currentHands = handsSnap.val();

      const newHands = { ...currentHands };
      for (const senderId of Object.keys(pCards)) {
        const receiverId = pTargets[senderId];
        const cards = pCards[senderId];
        newHands[senderId] = newHands[senderId].filter(c => !cards.find(x => x.id === c.id));
        newHands[receiverId] = [...(newHands[receiverId] || []), ...cards];
      }

      await update(ref(db, `rooms/${roomId}`), {
        hands: newHands, phase: "announcing", announceDone: {},
      });
    }
    setPassCards([]);
  }

  async function submitAnnounce(cardIds) {
    const newAnnounced = { ...announced };
    for (const id of cardIds) newAnnounced[id] = true;
    await update(ref(db, `rooms/${roomId}`), {
      [`announceDone/${myId}`]: true,
      announced: newAnnounced,
    });
    const snap = await get(ref(db, `rooms/${roomId}/announceDone`));
    if (snap.val() && Object.keys(snap.val()).length === 6) {
      await update(ref(db, `rooms/${roomId}`), { phase: "playing" });
    }
  }

  async function playCard(card) {
    if (!isMyTurn || phase !== "playing") return;

    const newTrick = [...trick, { playerId: myId, card }];
    const newHand = myHand.filter(c => c.id !== card.id);
    const newLeadSuit = trick.length === 0 ? card.suit : leadSuit;

    if (newTrick.length === 6) {
      // نعتمد هنا على دالة trickWinner الأساسية من ملفك الأصلي لضمان عدم حدوث شاشة سوداء
      const winnerId = trickWinner(newTrick, newLeadSuit);
      playVIPSound("trick_win");
      const winnerSnap = await get(ref(db, `rooms/${roomId}/piles/${winnerId}`));
      const winnerPile = winnerSnap.val() || [];
      const newPile = [...winnerPile, ...newTrick.map(t => t.card)];

      const allHandsSnap = await get(ref(db, `rooms/${roomId}/hands`));
      const allHands = allHandsSnap.val();
      allHands[myId] = newHand;
      const roundOver = Object.values(allHands).every(h => !h || h.length === 0);

      if (roundOver) {
        const pilesSnap = await get(ref(db, `rooms/${roomId}/piles`));
        const piles = pilesSnap.val() || {};
        piles[winnerId] = newPile;
        const roundScores = calcRoundScores(piles, announced, players);
        const newScores = {};
        for (const p of players) {
          newScores[p.id] = (scores[p.id] || 0) + (roundScores[p.id] || 0);
        }
        const gameOver = Object.values(newScores).some(s => s >= 360);
        await update(ref(db, `rooms/${roomId}`), {
          trick: [], leadSuit: null, piles: {},
          [`hands/${myId}`]: newHand, [`piles/${winnerId}`]: newPile,
          scores: newScores, lastRoundScores: roundScores,
          phase: gameOver ? "gameEnd" : "roundEnd", currentTurn: winnerId,
        });
      } else {
        await update(ref(db, `rooms/${roomId}`), {
          trick: [], leadSuit: null,
          [`hands/${myId}`]: newHand, [`piles/${winnerId}`]: newPile,
          currentTurn: winnerId, lastTrickWinner: winnerId,
        });
      }
    } else {
      const myIdx = players.findIndex(p => p.id === myId);
      const nextIdx = (myIdx - 1 + 6) % 6;
      const nextPlayer = players[nextIdx];
      await update(ref(db, `rooms/${roomId}`), {
        trick: newTrick, leadSuit: newLeadSuit,
        [`hands/${myId}`]: newHand, currentTurn: nextPlayer.id,
      });
    }
  }

  async function nextRound() {
    const deck = shuffle(makeDeck());
    const hands = {};
    players.forEach((p, i) => { hands[p.id] = deck.slice(i * 9, i * 9 + 9); });
    
    const currentDealerIdx = players.findIndex(p => p.id === dealerId);
    const nextDealerIdx = (currentDealerIdx + 1) % 6;
    const nextDealer = players[nextDealerIdx] || players[0];
    const starterIdx = (nextDealerIdx + 1) % 6;

    await update(ref(db, `rooms/${roomId}`), {
      hands, trick: [], leadSuit: null, piles: {},
      passed: {}, passedCards: {}, passTarget: {},
      announced: {}, announceDone: {}, phase: "passing",
      currentTurn: players[starterIdx].id, dealerId: nextDealer.id,
      lastRoundScores: null,
    });
    setPassCards([]);
  }

  const announceable = myHand.filter(c =>
    c.id === "JOKER" || c.id === "MIKER" || c.rank === "Q" || c.rank === "10"
  );
  const [announceSelected, setAnnounceSelected] = useState([]);
  const valid = phase === "playing" && isMyTurn ? validCards(myHand, trick, leadSuit).map(c => c.id) : [];
  const lastRound = room.lastRoundScores;
  const angles = [90, 30, 330, 270, 210, 150];

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(circle at center, #111d24 0%, #070c10 100%)",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "10px", gap: 10, direction: "rtl", boxSizing: "border-box"
    }}>
      
      {/* VIP Top Panel */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", maxWidth: 600, borderBottom: "2px solid #d4af37", paddingBottom: 6 }}>
        <div>
          <h2 style={{ color: "#ffe066", margin: 0, fontSize: "1.25rem", fontWeight: "900" }}>مجلس السبيته VIP</h2>
        </div>
        <div style={{ background: "rgba(212,175,55,0.1)", border: "1px solid #d4af37", padding: "4px 10px", borderRadius: 8, color: "#ffe066", fontSize: "0.75rem" }}>
          جلسة رقم: {roomId}
        </div>
      </div>

      {/* لوحة نقاط اللاعبين */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "center", width: "100%", maxWidth: 600 }}>
        {players.map((p, i) => (
          <div key={p.id} style={{
            background: p.id === myId ? "rgba(212,175,55,0.12)" : "rgba(255,255,255,0.02)",
            border: currentTurn === p.id && phase === "playing" ? "2px solid #ffca28" : "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10, padding: "5px 8px", textAlign: "center", minWidth: 82,
          }}>
            <div style={{ fontSize: "0.68rem", color: "#ffffff", fontWeight: "700" }}>
              {p.name} {dealerId === p.id ? "👑" : ""}
            </div>
            <div style={{ color: "#ffca28", fontWeight: 900, fontSize: "0.95rem" }}>{scores[p.id] || 0}</div>
          </div>
        ))}
      </div>

      {/* ── الطاولة المستديرة المحمية ── */}
      {phase === "playing" && (
        <div style={{
          position: "relative",
          width: "min(92vw, 420px)",
          height: "min(92vw, 420px)",
          background: "radial-gradient(circle, #0e4e27 0%, #063318 75%, #021a0b 100%)", 
          borderRadius: "50%",
          border: "10px solid #2b1910", 
          boxShadow: "0 12px 30px rgba(0,0,0,0.7), inset 0 0 25px rgba(0,0,0,0.85), 0 0 0 2px #d4af37",
          margin: "15px 0",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}>
          {players.map((p, idx) => {
            const angle = angles[idx];
            const radius = 130; 
            const x = Math.cos((angle * Math.PI) / 180) * radius;
            const y = Math.sin((angle * Math.PI) / 180) * radius;

            const trickItem = trick.find(t => t.playerId === p.id);
            const isPlayerTurn = currentTurn === p.id;

            return (
              <div
                key={p.id}
                style={{
                  position: "absolute",
                  left: `calc(50% + ${x}px - 44px)`,
                  top: `calc(50% - ${y}px - 54px)`,
                  width: 88, height: 108,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  zIndex: isPlayerTurn ? 15 : 10,
                }}
              >
                <div style={{ height: 72, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 3 }}>
                  {trickItem ? (
                    <div style={{ transform: `rotate(${(idx * 5) - 10}deg)` }}>
                      <CardUI card={trickItem.card} disabled small announced={announced} />
                    </div>
                  ) : (
                    <div style={{
                      width: 40, height: 54, borderRadius: 6,
                      border: isPlayerTurn ? "2px solid #ffca28" : "1.5px dashed rgba(255,255,255,0.08)",
                      background: isPlayerTurn ? "rgba(255,202,40,0.04)" : "transparent",
                    }} />
                  )}
                </div>

                <div style={{
                  background: isPlayerTurn ? "#ffca28" : "rgba(0,0,0,0.8)",
                  color: isPlayerTurn ? "#000000" : "#ffffff",
                  padding: "2px 6px", borderRadius: 6, fontSize: "0.62rem", fontWeight: "700", whiteSpace: "nowrap"
                }}>
                  {p.name}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── المراحل والأزرار ── */}
      {phase === "passing" && !myPassDone && (
        <div style={phaseBox}>
          <div style={phaseTitle}>📤 مرحلة الترحيل: اختر 3 أوراق لترحيلها</div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center" }}>
            {myHand.map(c => (
              <CardUI key={c.id} card={c} selected={!!passCards.find(x => x.id === c.id)} onClick={() => togglePassCard(c)} />
            ))}
          </div>
          <button onClick={submitPass} style={btnGold} disabled={passCards.length !== 3}>تأكيد إرسال الأوراق ({passCards.length}/3)</button>
        </div>
      )}
      {phase === "passing" && myPassDone && (
        <div style={phaseBox}><div style={{ color: "#2ed573" }}>📬 تم الترحيل، ننتظر الآخرين...</div></div>
      )}

      {phase === "announcing" && !myAnnounceDone && (
        <div style={phaseBox}>
          <div style={phaseTitle}>📢 المشاريع المتوفرة لإعلانها</div>
          {announceable.length > 0 ? (
            <>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "center" }}>
                {announceable.map(c => (
                  <div key={c.id} onClick={() => {
                    if (announceSelected.includes(c.id)) setAnnounceSelected(announceSelected.filter(x => x !== c.id));
                    else setAnnounceSelected([...announceSelected, c.id]);
                  }}>
                    <CardUI card={c} selected={announceSelected.includes(c.id)} />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, width: "100%" }}>
                <button onClick={() => submitAnnounce(announceSelected)} style={btnGold}>📢 إعلان المشاريع</button>
                <button onClick={() => submitAnnounce([])} style={btnOutline}>تخطي</button>
              </div>
            </>
          ) : (
            <button onClick={() => submitAnnounce([])} style={btnGold}>دخول الساحة وبدء اللعب مباشر ▶</button>
          )}
        </div>
      )}
      {phase === "announcing" && myAnnounceDone && (
        <div style={phaseBox}><div style={{ color: "#2ed573" }}>بانتظار إعلانات بقية المجلس...</div></div>
      )}

      {/* أوراق اليد الحية للمستخدم */}
      {phase === "playing" && (
        <div style={{ width: "100%", maxWidth: 500, background: "rgba(255,255,255,0.02)", borderRadius: 16, padding: 12 }}>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", justifyContent: "center" }}>
            {myHand.map(c => (
              <CardUI
                key={c.id} card={c}
                onClick={() => playCard(c)}
                disabled={!isMyTurn || (valid.length > 0 && !valid.includes(c.id))}
              />
            ))}
          </div>
        </div>
      )}

      {/* لوحة نهاية الشوط والجولة */}
      {(phase === "roundEnd" || phase === "gameEnd") && (
        <div style={phaseBox}>
          <div style={phaseTitle}>{phase === "gameEnd" ? "🏆 انتهت اللعبة الملكية!" : "🎴 جرد نقاط الجولة"}</div>
          {phase === "roundEnd" && myId === players[0]?.id && (
            <button onClick={nextRound} style={btnGold}>◀ افتح الجولة التالية</button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── الأنماط الفاخرة الموحدة ──────────────────────────────────────────────────
const inputStyle = { background: "rgba(0, 0, 0, 0.45)", border: "1px solid rgba(212,175,55,0.45)", borderRadius: 12, padding: "14px 16px", color: "#ffffff", width: "100%", boxSizing: "border-box", textAlign: "right" };
const btnGold = { background: "linear-gradient(135deg, #ffe066 0%, #f5b041 100%)", border: "none", borderRadius: 12, padding: "14px 24px", color: "#0b1015", fontWeight: 900, cursor: "pointer", width: "100%" };
const btnOutline = { background: "transparent", border: "1px solid rgba(212,175,55,0.45)", borderRadius: 12, padding: "12px 24px", color: "#ffe066", fontWeight: 700, cursor: "pointer", width: "100%" };
const phaseBox = { background: "rgba(0,0,0,0.45)", border: "1px solid #d4af37", borderRadius: 16, padding: "20px", width: "100%", maxWidth: 500, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 };
const phaseTitle = { color: "#ffe066", fontWeight: 900, fontSize: "1.05rem" };

function generateRoomId() { return Math.random().toString(36).substring(2, 8).toUpperCase(); }

export default function App() {
  const [screen, setScreen] = useState("home"); 
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
    setMyId(playerId);
    setRoomId(id);
    await set(ref(db, `rooms/${id}`), {
      phase: "lobby",
      players: { [playerId]: { id: playerId, name, seat: 0 } },
      scores: {}, trick: [], leadSuit: null, announced: {}, dealerId: playerId
    });
  }

  async function joinRoom(name, id) {
    const snap = await get(ref(db, `rooms/${id}`));
    const data = snap.val();
    if (!data) return alert("الجلسة غير موجودة!");
    const existing = Object.values(data.players || {});
    if (existing.length >= 6) return alert("المجلس ممتلئ!");
    const playerId = `p_${Date.now()}`;
    setMyId(playerId);
    setRoomId(id);
    await update(ref(db, `rooms/${id}/players`), {
      [playerId]: { id: playerId, name, seat: existing.length },
    });
  }

  async function startGame() {
    const currentPlayers = Object.values(room.players).sort((a, b) => a.seat - b.seat);
    const deck = shuffle(makeDeck());
    const hands = {};
    currentPlayers.forEach((p, i) => { hands[p.id] = deck.slice(i * 9, i * 9 + 9); });

    await update(ref(db, `rooms/${roomId}`), {
      hands, phase: "passing", trick: [], leadSuit: null, piles: {},
      passed: {}, passedCards: {}, passTarget: {}, announced: {}, announceDone: {},
      scores: Object.fromEntries(currentPlayers.map(p => [p.id, 0])),
      currentTurn: currentPlayers[0].id,
    });
  }

  if (screen === "home") return <HomeScreen onHost={hostRoom} onJoin={joinRoom} />;
  if (screen === "lobby" && room) return <LobbyScreen room={room} roomId={roomId} myId={myId} onStart={startGame} />;
  if (screen === "game" && room) return <GameScreen room={room} roomId={roomId} myId={myId} />;
  return <div style={{ color: "#f5b041", textAlign: "center", padding: 60 }}>جاري التجهيز...</div>;
}
