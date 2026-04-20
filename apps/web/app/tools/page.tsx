import Link from 'next/link';

const tools = [
  {
    href: '/tools/power',
    title: 'Power Calculator',
    category: 'Sample size',
    description: 'Estimate required control and treatment sample sizes before launching a test.',
  },
];

export default function ToolsPage() {
  return (
    <div className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="mb-1">Tools</h1>
          <p className="text-muted mb-0">Experiment calculators</p>
        </div>
      </div>

      <div className="row g-3">
        {tools.map((tool) => (
          <div className="col-md-6 col-lg-4" key={tool.href}>
            <Link href={tool.href} className="card h-100 text-decoration-none text-body">
              <div className="card-body">
                <span className="badge bg-body-secondary text-body border mb-2">
                  {tool.category}
                </span>
                <h5 className="card-title">{tool.title}</h5>
                <p className="card-text text-muted mb-0">{tool.description}</p>
              </div>
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
