import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./TournamentPopup.css";

const TOURNAMENT_START = new Date("2026-06-14T08:00:00+08:00").getTime();

function getRemainingTime() {
  const remaining = Math.max(0, TOURNAMENT_START - Date.now());

  return {
    days: Math.floor(remaining / (1000 * 60 * 60 * 24)),
    hours: Math.floor((remaining / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((remaining / (1000 * 60)) % 60),
    seconds: Math.floor((remaining / 1000) % 60),
  };
}

export default function TournamentPopup() {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [posterSrc, setPosterSrc] = useState("/tournamentbanner.png");
  const [countdown, setCountdown] = useState(getRemainingTime);

  const details = useMemo(
    () => [
      "📅 June 14, 2026 (Sunday)",
      "🕗 8:00 AM Onwards",
      "🏸 Doubles Tournament",
      "🏸 Mixed Doubles Also Welcome",
      "👥 Maximum 32 Teams",
      "🏆 League Stage ➡ Quarter Final ➡ Semi Final ➡ Final",
      "✅ Minimum 3 Matches Per Team",
      "💰 40 SGD Per Team",
      "🏆 500 SGD + Trophies",
      "📍 Block 306, UBI Avenue 1, Singapore - 400306",
      "Above Giant Super Market - Level 3",
      "📅 Registration Deadline: May 20, 2026",
      "🍎 Fruits  🥤 Drinks  🍿 Snacks",
      "🥇 Participant Medals For Everyone",
    ],
    []
  );

  useEffect(() => {
    const showTimer = window.setTimeout(() => setIsVisible(true), 1000);
    return () => window.clearTimeout(showTimer);
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    const countdownTimer = window.setInterval(() => {
      setCountdown(getRemainingTime());
    }, 1000);

    return () => window.clearInterval(countdownTimer);
  }, [isVisible]);

  const closePopup = () => {
    setIsClosing(true);
    window.setTimeout(() => {
      setIsVisible(false);
      setIsClosing(false);
    }, 220);
  };

  const goToTournament = () => {
    closePopup();
    navigate("/tournament");
  };

  const registerTeam = () => {
    closePopup();
    navigate("/tournament");
  };

  if (!isVisible) return null;

  return (
    <div className={`tournament-popup-overlay ${isClosing ? "is-closing" : ""}`} role="presentation">
      <section className="tournament-popup-card" role="dialog" aria-modal="true" aria-labelledby="tournament-popup-title">
        <button className="tournament-popup-close" type="button" aria-label="Close tournament popup" onClick={closePopup}>
          X
        </button>

        <div className="tournament-popup-scroll">
          <img
            className="tournament-popup-poster"
            src={posterSrc}
            alt="UBI Smashers Badminton Tournament 2026 poster"
            onError={() => setPosterSrc("/background.png")}
          />

          <div className="tournament-popup-content">
            <h2 id="tournament-popup-title">UBI Smashers Badminton Tournament 2026</h2>

            <div className="tournament-popup-countdown" aria-label="Countdown to tournament start">
              <div>
                <strong>{countdown.days}</strong>
                <span>Days</span>
              </div>
              <div>
                <strong>{countdown.hours}</strong>
                <span>Hours</span>
              </div>
              <div>
                <strong>{countdown.minutes}</strong>
                <span>Minutes</span>
              </div>
              <div>
                <strong>{countdown.seconds}</strong>
                <span>Seconds</span>
              </div>
            </div>

            <div className="tournament-popup-details">
              {details.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>

            <div className="tournament-popup-contact">
              <p>For Registration Contact:</p>
              <strong>📞 Mani - 8615 2500</strong>
              <strong>📞 Deepan - 9782 5432</strong>
            </div>

            <div className="tournament-popup-actions">
              <button className="tournament-popup-primary" type="button" onClick={goToTournament}>
                Go To Tournament
              </button>
              <button className="tournament-popup-secondary" type="button" onClick={registerTeam}>
                Register Team
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
