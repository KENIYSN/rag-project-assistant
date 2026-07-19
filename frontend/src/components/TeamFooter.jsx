export default function TeamFooter() {
  return (
    <footer className="team-footer">
      <div className="team-members">
        {/* Mohammed */}
        <div className="team-member">
          <div className="team-tooltip">
            <div className="tooltip-name">Mohammed Nassiri</div>
            <div className="tooltip-role">Frontend & LLM Integration</div>
          </div>
          <img
            className="team-avatar"
            src="/avatar_mohammed.png"
            alt="Mohammed Nassiri"
          />
        </div>

        {/* Yassine */}
        <div className="team-member">
          <div className="team-tooltip">
            <div className="tooltip-name">Yassine Esserdaoui</div>
            <div className="tooltip-role">Backend & Data Pipeline</div>
          </div>
          <img
            className="team-avatar"
            src="/avatar_yassine.png"
            alt="Yassine Esserdaoui"
          />
        </div>
      </div>
    </footer>
  );
}
