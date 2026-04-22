// Compact list row — colored LEGO stud + name + count.
// Replaces the big Pick-A-Brick bowl visualization to save vertical space.

function BrickJar({ color, count, max = 120, name, onClick }) {
  const pct = Math.min(1, count / Math.max(1, max));
  return (
    <button className="jar jar-row" onClick={onClick} title={`${name}: ${count} bricks`}>
      <span className="jar-stud" style={{background: color}} aria-hidden="true">
        <span className="jar-stud-hi" />
      </span>
      <span className="jar-name">{name}</span>
      <span className="jar-bar" aria-hidden="true">
        <span className="jar-bar-fill" style={{width: `${pct * 100}%`, background: color}} />
      </span>
      <span className="jar-count">{count.toLocaleString()}</span>
    </button>
  );
}

window.BrickJar = BrickJar;
