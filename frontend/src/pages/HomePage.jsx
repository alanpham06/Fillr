import { Link } from "react-router-dom";

const STEPS = [
  {
    n: "1",
    title: "Add your slides",
    body: "Upload a lecture PDF or a photo of slides, notes, or a textbook chapter.",
  },
  {
    n: "2",
    title: "Choose how it scaffolds",
    body: "Pick how much is already written, template text size, and whether to leave room for diagrams or code.",
  },
  {
    n: "3",
    title: "Generate a fill-in template",
    body: "We build an intentionally incomplete note sheet — headings and blanks, not a finished summary.",
  },
  {
    n: "4",
    title: "Write, type, and export",
    body: "Open the PDF workspace to write or type, save progress in this browser, then download a flattened PDF.",
  },
];

const STYLES = [
  ["More structure", "Keep more of the lecture structure printed"],
  ["More blank space", "Leave extra space to write during class"],
  ["Leave room for diagrams", "Empty frames where figures belong"],
  ["Leave room for code", "Room to copy examples by hand"],
  ["Write + Type", "Pen, highlighter, eraser, and growing text boxes"],
  ["Completed-notes OCR", "Photograph the sheet; we merge the writing back in"],
];

export default function HomePage() {
  return (
    <div className="page-doc">
      <section className="hero">
        <p className="hero-kicker">Active learning, by design</p>
        <h1>
          Turn slides and readings into
          <br />
          notes you <em>complete</em>, not copy.
        </h1>
        <p className="hero-lead">
          Fillr builds scaffolded fill-in sheets from your course
          material — with blanks to write, slots to sketch, and space to type.
          It is a lecture template generator, not a homework solver, and it
          deliberately leaves the thinking to you.
        </p>
        <div className="hero-actions">
          <Link to="/create" className="primary hero-btn">
            Create a template →
          </Link>
          <Link to="/history" className="secondary hero-btn">
            View history
          </Link>
        </div>
      </section>

      <section className="step-grid">
        {STEPS.map((step) => (
          <div key={step.n} className="card step-card">
            <div className="step-n">{step.n}</div>
            <h3>{step.title}</h3>
            <p className="muted">{step.body}</p>
          </div>
        ))}
      </section>

      <section className="home-split">
        <div className="card">
          <p className="section-kicker">What you can generate</p>
          <ul className="style-list">
            {STYLES.map(([name, desc]) => (
              <li key={name}>
                <span>{name}</span>
                <span className="muted">{desc}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card principle-card">
          <p className="section-kicker accent">The principle</p>
          <p className="principle-copy">
            Templates are <strong>scaffolds, not summaries</strong>. Generated
            sheets may miss topics from the source slides. Fill them in while
            you listen — this is not a homework Q&amp;A tool and it will not
            write full answers for you.
          </p>
        </div>
      </section>

      <section className="card home-callout">
        <h3>After class, upload the filled sheet</h3>
        <p className="muted">
          Photograph or scan your completed notes. We OCR the writing and drop
          it back onto the template in teal ink. Handwriting accuracy is
          limited — this merges what you wrote; it does not invent answers.
        </p>
      </section>
    </div>
  );
}
