import { useState } from 'react';

const SECTIONS = [
  { id: 'overview',      label: '📋 Overview' },
  { id: 'dashboard',     label: '🏠 Dashboard' },
  { id: 'portfolios',    label: '💼 Portfolios' },
  { id: 'programs',      label: '📁 Programs' },
  { id: 'projects',      label: '🗂️ Projects' },
  { id: 'tasks',         label: '✅ Tasks' },
  { id: 'subtasks',      label: '↳ Subtasks' },
  { id: 'gantt',         label: '📅 Gantt Chart' },
  { id: 'scheduling',    label: '⚙️ Scheduling Engine' },
  { id: 'baselines',     label: '📐 Schedule Baselines' },
  { id: 'calendar',      label: '📆 Working Calendar' },
  { id: 'evm',           label: '📊 Earned Value (EVM)' },
  { id: 'resources',     label: '👥 Resourcing' },
  { id: 'risks',         label: '⚠️ Risks' },
  { id: 'risk-management', label: '🛡️ Risk Management Page' },
  { id: 'clickup',       label: '🔗 ClickUp Integration' },
  { id: 'admin-users',   label: '👤 Managing Users' },
  { id: 'admin-roles',   label: '🔑 Roles & Permissions' },
  { id: 'admin-teams',   label: '🏢 Teams' },
  { id: 'admin-company', label: '🏷️ Company Setup' },
  { id: 'admin-calendar',label: '📆 Working Calendar Admin' },
  { id: 'reports',       label: '📊 Reports' },
  { id: 'capacity',      label: '👥 Resource Capacity' },
];

function Section({ id, title, children }) {
  return (
    <div id={`manual-${id}`} style={sc.section}>
      <h2 style={sc.h2}>{title}</h2>
      {children}
    </div>
  );
}

function Steps({ items }) {
  return (
    <ol style={sc.ol}>
      {items.map((item, i) => (
        <li key={i} style={sc.li}>{item}</li>
      ))}
    </ol>
  );
}

function Note({ children }) {
  return <div style={sc.note}><strong>💡 Note:</strong> {children}</div>;
}

function Warn({ children }) {
  return <div style={sc.warn}><strong>⚠️ Important:</strong> {children}</div>;
}

function SubHeading({ children }) {
  return <h3 style={sc.h3}>{children}</h3>;
}

export default function UserManual({ onClose }) {
  const [active, setActive] = useState('overview');

  const scrollTo = (id) => {
    setActive(id);
    const el = document.getElementById(`manual-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div style={sc.overlay}>
      <div style={sc.panel}>

        {/* ── Header ─────────────────────────────────────────────────── */}
        <div style={sc.header}>
          <div>
            <div style={sc.headerTitle}>📖 User Manual</div>
            <div style={sc.headerSub}>Portfolio Manager — Complete Guide</div>
          </div>
          <button onClick={onClose} style={sc.closeBtn} title="Close">✕</button>
        </div>

        <div style={sc.body}>

          {/* ── Table of Contents ───────────────────────────────────── */}
          <nav style={sc.toc}>
            <div style={sc.tocTitle}>Contents</div>
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => scrollTo(s.id)}
                style={{ ...sc.tocItem, ...(active === s.id ? sc.tocActive : {}) }}
              >
                {s.label}
              </button>
            ))}
          </nav>

          {/* ── Content ─────────────────────────────────────────────── */}
          <div style={sc.content}>

            {/* OVERVIEW */}
            <Section id="overview" title="📋 Overview">
              <p style={sc.p}>
                The <strong>Portfolio Manager</strong> is a web-based project management platform that organises work across a four-level hierarchy:
              </p>
              <div style={sc.hierarchy}>
                <div style={sc.hLevel}><span style={sc.hIcon}>💼</span> <strong>Portfolio</strong> — top-level grouping (e.g. a business unit or product line)</div>
                <div style={sc.hLevel}><span style={sc.hIcon}>📁</span> <strong>Program</strong> — a collection of related projects within a portfolio</div>
                <div style={sc.hLevel}><span style={sc.hIcon}>🗂️</span> <strong>Project</strong> — a distinct deliverable within a program</div>
                <div style={sc.hLevel}><span style={sc.hIcon}>✅</span> <strong>Task</strong> — individual work items within a project, which can have sub-tasks</div>
              </div>
              <Note>All actions are permission-controlled. If a button is missing, your role may not have access to that feature.</Note>
            </Section>

            {/* DASHBOARD */}
            <Section id="dashboard" title="🏠 Dashboard">
              <p style={sc.p}>The Dashboard provides a real-time overview of the entire portfolio.</p>

              <SubHeading>Summary Cards</SubHeading>
              <p style={sc.p}>The top row shows counts for active Portfolios, Programs, Projects, and open Tasks. Click any card to navigate to that section.</p>

              <SubHeading>Portfolio Cards</SubHeading>
              <p style={sc.p}>Each portfolio card shows a four-row summary:</p>
              <ul style={sc.ul}>
                <li style={sc.li}><strong>Row 1:</strong> Portfolio name and status.</li>
                <li style={sc.li}><strong>Row 2:</strong> Task date range.</li>
                <li style={sc.li}><strong>Row 3:</strong> Program count, project count, and active task count.</li>
                <li style={sc.li}><strong>Row 4:</strong> High-risk task count, over-budget task count with dollar overrun, and EVM metrics (BAC, CPI, SPI).</li>
              </ul>
              <p style={sc.p}>Click any portfolio card to open its detail page.</p>

              <SubHeading>Schedule View (Gantt)</SubHeading>
              <p style={sc.p}>All programs and their projects are combined into a single Gantt chart. The timeline uses a <strong>monthly</strong> scale. The Schedule View appears <strong>above</strong> the Risk Management section. Click the header to collapse or expand it.</p>

              <SubHeading>Risk Management Panel</SubHeading>
              <p style={sc.p}>Three risk columns are displayed side-by-side inside a collapsible section:</p>
              <ul style={sc.ul}>
                <li style={sc.li}><strong>High &amp; Critical Risk Tasks</strong> — tasks with a risk rating <strong>above 10</strong> (High ≥ 11, Critical &gt; 15). Milestone tasks are excluded.</li>
                <li style={sc.li}><strong>Overdue Tasks</strong> — open tasks whose due date has passed. The pill shows how many days overdue.</li>
                <li style={sc.li}><strong>Over Budget Tasks</strong> — tasks where actual hours exceed estimated hours. Each item shows hours over estimate and the dollar overrun.</li>
              </ul>
              <p style={sc.p}><strong>Every task row is clickable</strong> — clicking a row navigates directly to the task's parent project or program.</p>

              <SubHeading>Earned Value Overview</SubHeading>
              <p style={sc.p}>Below the Risk section, the Dashboard shows an <strong>EVM panel for each portfolio</strong> labelled with the portfolio name. It gives a rolled-up view of BAC, CPI, SPI, and forecast completion cost. Milestone tasks are excluded from all EVM calculations. See the <em>Earned Value (EVM)</em> section for details.</p>
            </Section>

            {/* PORTFOLIOS */}
            <Section id="portfolios" title="💼 Portfolios">
              <SubHeading>Viewing Portfolios</SubHeading>
              <p style={sc.p}>Navigate to <strong>Portfolios</strong> in the sidebar to see all portfolios you have access to. Each card shows the name, status, priority, date range, and counts of programs, projects, and tasks.</p>

              <SubHeading>Creating a Portfolio</SubHeading>
              <Steps items={[
                'Click the green + New Portfolio button in the top-right.',
                'Fill in the Name (required), Description, Status, Priority (1–10), Start Date, and End Date.',
                'Click Save.',
              ]} />

              <SubHeading>Editing a Portfolio</SubHeading>
              <Steps items={[
                'Click the Edit button on the portfolio card.',
                'Update any fields.',
                'Click Save.',
              ]} />

              <SubHeading>Deleting a Portfolio</SubHeading>
              <Steps items={[
                'Click the Delete button on the portfolio card.',
                'Confirm the deletion in the dialog.',
              ]} />
              <Warn>Deleting a portfolio will remove all programs, projects, and tasks within it.</Warn>

              <SubHeading>Viewing Portfolio Detail</SubHeading>
              <p style={sc.p}>Click the portfolio name or card to open the detail page, which lists all programs within that portfolio.</p>
            </Section>

            {/* PROGRAMS */}
            <Section id="programs" title="📁 Programs">
              <SubHeading>Viewing Programs</SubHeading>
              <p style={sc.p}>Click <strong>Programs</strong> in the sidebar to see all programs across every portfolio. Use the <strong>Portfolios</strong> detail page to see programs for a specific portfolio.</p>

              <SubHeading>Creating a Program</SubHeading>
              <Steps items={[
                'From the Programs list, click + New Program.',
                'Select the parent Portfolio from the dropdown.',
                'Fill in Name, Description, Status, Priority, Start Date, and End Date.',
                'Click Save.',
              ]} />

              <SubHeading>Editing / Deleting a Program</SubHeading>
              <p style={sc.p}>Use the Edit or Delete buttons on the program card. Deletion removes all projects and tasks within.</p>

              <SubHeading>Program Detail Page</SubHeading>
              <p style={sc.p}>Click a program name to open its detail page, which shows all projects in the program along with a Gantt chart of those projects.</p>
              <Note>Tasks cannot be added directly from the Program detail page — tasks belong to projects.</Note>
            </Section>

            {/* PROJECTS */}
            <Section id="projects" title="🗂️ Projects">
              <SubHeading>Viewing Projects</SubHeading>
              <p style={sc.p}>Click <strong>Projects</strong> in the sidebar to see all projects. Click any project name to open its detail page.</p>

              <SubHeading>Creating a Project</SubHeading>
              <Steps items={[
                'Click + New Project.',
                'Select the parent Program.',
                'Fill in Name, Description, Status, Priority, Start Date, End Date.',
                'Optionally enter a ClickUp ID to link this project to a ClickUp task.',
                'Click Save.',
              ]} />

              <SubHeading>Project Detail Page</SubHeading>
              <p style={sc.p}>The detail page shows:</p>
              <ul style={sc.ul}>
                <li style={sc.li}>Project metadata, completion bar, and average risk rating.</li>
                <li style={sc.li}>A <strong>List / Gantt</strong> toggle to switch between the task tree and Gantt chart.</li>
                <li style={sc.li}>A <strong>+ Add Task</strong> button to create tasks directly within this project.</li>
                <li style={sc.li}>A <strong>📐 Schedule Baselines</strong> panel (in Gantt view) for saving and comparing baselines.</li>
                <li style={sc.li}>A <strong>📊 EVM panel</strong> showing earned value metrics for this project's tasks.</li>
                <li style={sc.li}>A <strong>🔍 Detailed Insights</strong> button (if a ClickUp ID is set) to pull live data from ClickUp.</li>
              </ul>

              <Note>Tasks can only be added from the Project detail page, not from the Programs or Portfolios pages.</Note>
            </Section>

            {/* TASKS */}
            <Section id="tasks" title="✅ Tasks">
              <SubHeading>Viewing All Tasks</SubHeading>
              <p style={sc.p}>Click <strong>Tasks</strong> in the sidebar. Switch between <strong>List</strong> (card) and <strong>Table</strong> views using the toggle. Use the filter buttons (All / Mine / Open / In Progress) to narrow the list. The table view shows sortable <em>Portfolio → Program → Project</em> breadcrumb columns.</p>

              <SubHeading>Task Form Tabs</SubHeading>
              <p style={sc.p}>The task create/edit form has five tabs:</p>
              <ul style={sc.ul}>
                <li style={sc.li}><strong>📋 Task Details</strong> — title, description, priority, status, % complete, dates, milestone flag, parent task, and dependencies.</li>
                <li style={sc.li}><strong>⚠️ Risk</strong> — probability, impact, risk name, description, mitigation plan, and risk status (Open / Active / Mitigated / Closed).</li>
                <li style={sc.li}><strong>👥 Resourcing</strong> — assign team members with estimated and actual hours.</li>
                <li style={sc.li}><strong>📅 Schedule</strong> — constraint type, constraint date, schedule mode, and read-only CPM results.</li>
                <li style={sc.li}><strong>📝 Notes</strong> — a large free-text area for meeting notes, decisions, links, or any additional context. A ✓ badge appears on the tab when notes exist.</li>
              </ul>

              <SubHeading>Creating a Task</SubHeading>
              <Steps items={[
                'Navigate to a Project detail page.',
                'Click + Add Task.',
                'Fill in the Title (required).',
                'Set a Start Date and End Date — both are mandatory.',
                'Set Priority (1–10), Status, and % Complete as needed.',
                'On the Risk tab, optionally add a risk name, probability, impact, and select a Risk Status.',
                'On the Resourcing tab, assign team members with estimated and actual hours.',
                'On the Schedule tab, set constraint type and schedule mode.',
                'On the Notes tab, capture any additional context or decisions.',
                'Click Save.',
              ]} />
              <Warn>Start Date and End Date are required. A task cannot be saved without both dates.</Warn>

              <SubHeading>Editing a Task</SubHeading>
              <Steps items={[
                'Click the Edit button on any task row.',
                'Update the fields as needed.',
                'Click Save.',
              ]} />

              <SubHeading>Deleting a Task</SubHeading>
              <Steps items={[
                'Click the Delete button on any task row.',
                'Confirm in the dialog.',
              ]} />
              <Warn>Deleting a task also deletes all its sub-tasks.</Warn>

              <SubHeading>Reordering Tasks</SubHeading>
              <p style={sc.p}>Drag the ⠿ handle on the left of any task row to reorder tasks within the project.</p>

              <SubHeading>Task Status Values</SubHeading>
              <ul style={sc.ul}>
                <li style={sc.li}><strong>Open</strong> — not yet started</li>
                <li style={sc.li}><strong>In Progress</strong> — actively being worked on</li>
                <li style={sc.li}><strong>Completed</strong> — done</li>
                <li style={sc.li}><strong>Cancelled</strong> — will not be done</li>
              </ul>
            </Section>

            {/* SUBTASKS */}
            <Section id="subtasks" title="↳ Subtasks">
              <p style={sc.p}>Tasks support unlimited nesting — a task can have sub-tasks, which can themselves have sub-tasks.</p>

              <SubHeading>Creating a Sub-task</SubHeading>
              <Steps items={[
                'In the task list on a Project detail page, find the parent task.',
                'Click the + Sub button on the right of that task row.',
                'Fill in the sub-task details. The Parent Task field is pre-filled.',
                'Set Start Date and End Date — these must fall within the parent task\'s date range.',
                'Click Save.',
              ]} />
              <Warn>A sub-task's dates must be within the parent task's Start and End dates. The form will reject dates outside this range.</Warn>

              <SubHeading>Expanding / Collapsing Sub-tasks</SubHeading>
              <Steps items={[
                'Click the ▶ / ▼ toggle next to a task that has sub-tasks.',
                'Sub-tasks are indented below their parent.',
              ]} />

              <SubHeading>Changing a Task's Parent</SubHeading>
              <Steps items={[
                'Click Edit on any task.',
                'Use the Parent Task dropdown to assign or change the parent.',
                'The dropdown excludes the task itself and all its descendants to prevent circular references.',
                'Click Save.',
              ]} />

              <Note>Sub-tasks appear indented in both the List view and the Gantt chart.</Note>
            </Section>

            {/* GANTT */}
            <Section id="gantt" title="📅 Gantt Chart">
              <p style={sc.p}>The Gantt chart provides a visual timeline for tasks and projects. It is available on Project detail pages and the Dashboard.</p>

              <SubHeading>Switching to Gantt View</SubHeading>
              <Steps items={[
                'Open a Project detail page.',
                'Click the Gantt button next to the List button above the task list.',
              ]} />

              <SubHeading>Reading the Chart</SubHeading>
              <ul style={sc.ul}>
                <li style={sc.li}>Each row represents a task. Sub-tasks are indented below their parent with a <strong>↳</strong> connector.</li>
                <li style={sc.li}>Bars are coloured by status (green = open, amber = in progress, grey = cancelled, bright green = completed).</li>
                <li style={sc.li}>A white overlay inside the bar shows <strong>% complete</strong>.</li>
                <li style={sc.li}>Diamond shapes ◆ represent <strong>milestones</strong>.</li>
                <li style={sc.li}>The vertical green line marks <strong>Today</strong>.</li>
                <li style={sc.li}>Dashed arrows show <strong>task dependencies</strong>.</li>
                <li style={sc.li}>Tasks highlighted in <span style={{ color: '#dc2626' }}>red</span> are on the <strong>Critical Path</strong>.</li>
              </ul>

              <SubHeading>Editing from the Gantt</SubHeading>
              <p style={sc.p}>Click any bar or task name in the Gantt to open the task edit form.</p>

              <SubHeading>Dashboard Gantt</SubHeading>
              <p style={sc.p}>The Dashboard shows all programs combined into one Gantt chart with a <strong>monthly</strong> timeline scale.</p>
            </Section>

            {/* SCHEDULING ENGINE */}
            <Section id="scheduling" title="⚙️ Scheduling Engine">
              <p style={sc.p}>
                The Scheduling Engine automatically calculates task start and finish dates using the <strong>Critical Path Method (CPM)</strong>. It runs automatically whenever a task's dates or dependencies change.
              </p>

              <SubHeading>Schedule Modes</SubHeading>
              <ul style={sc.ul}>
                <li style={sc.li}><strong>Auto (CPM-driven)</strong> — dates are computed by the engine based on dependencies and constraints.</li>
                <li style={sc.li}><strong>Manual (pin dates)</strong> — you set dates directly; the engine does not move them.</li>
              </ul>

              <SubHeading>Constraint Types</SubHeading>
              <p style={sc.p}>Open a task's <strong>📅 Schedule</strong> tab to set a constraint:</p>
              <ul style={sc.ul}>
                <li style={sc.li}><strong>ASAP</strong> — As Soon As Possible (default). Task starts at the earliest date allowed by its predecessors.</li>
                <li style={sc.li}><strong>ALAP</strong> — As Late As Possible. Task is pushed as late as possible without delaying the project end.</li>
                <li style={sc.li}><strong>MSO</strong> — Must Start On a specific date.</li>
                <li style={sc.li}><strong>MFO</strong> — Must Finish On a specific date.</li>
                <li style={sc.li}><strong>SNET</strong> — Start No Earlier Than a given date.</li>
                <li style={sc.li}><strong>FNLT</strong> — Finish No Later Than a given date.</li>
              </ul>

              <SubHeading>Dependencies with Lag / Lead Time</SubHeading>
              <p style={sc.p}>Open the <strong>📋 Task Details</strong> tab and scroll to <em>Dependencies</em> to add predecessor tasks:</p>
              <Steps items={[
                'Click the "— Add predecessor —" dropdown and select a task.',
                'Set a Lag value: positive = gap days after the predecessor finishes; negative = overlap (lead time).',
                'Click + Add. Multiple predecessors can be added.',
                'Save the task. The engine re-runs automatically.',
              ]} />

              <SubHeading>CPM Results (read-only)</SubHeading>
              <p style={sc.p}>After the engine runs, the <strong>📅 Schedule tab</strong> of any task shows the calculated CPM fields:</p>
              <ul style={sc.ul}>
                <li style={sc.li}><strong>Early Start / Early Finish</strong> — earliest the task can start/finish given its predecessors.</li>
                <li style={sc.li}><strong>Late Start / Late Finish</strong> — latest it can start/finish without delaying the project.</li>
                <li style={sc.li}><strong>Float</strong> — working days of slack. Float = 0 means the task is on the <strong>Critical Path</strong>.</li>
                <li style={sc.li}><strong>Duration</strong> — calendar days between Start and Due date.</li>
              </ul>

              <SubHeading>Critical Path Highlighting</SubHeading>
              <p style={sc.p}>Tasks on the Critical Path are highlighted in <span style={{ color: '#dc2626', fontWeight: 700 }}>red</span> in the Gantt chart. A red summary line at the bottom of the chart spans the full critical-path duration.</p>

              <SubHeading>Drag-to-Reschedule (Interactive Gantt)</SubHeading>
              <p style={sc.p}>In the Gantt chart on a Project detail page you can drag bars to reschedule tasks:</p>
              <Steps items={[
                'Drag a bar left or right to move the task start and finish dates.',
                'Drag the right edge of a bar to resize (change the finish date only).',
                'While dragging, a live preview (amber highlight) shows the projected impact on dependent tasks.',
                'Release the mouse button to commit the change. The scheduler re-runs automatically.',
              ]} />
              <Note>Drag-to-reschedule only works when you have edit permissions on tasks.</Note>
            </Section>

            {/* SCHEDULE BASELINES */}
            <Section id="baselines" title="📐 Schedule Baselines">
              <p style={sc.p}>
                A <strong>baseline</strong> is a named snapshot of all task dates at a point in time. You can compare the current schedule against a baseline to see how dates have shifted.
              </p>

              <SubHeading>Saving a Baseline</SubHeading>
              <Steps items={[
                'Open a Project detail page and switch to Gantt view.',
                'Scroll down to the 📐 Schedule Baselines panel.',
                'Type a name (e.g. "Sprint 1 Baseline").',
                'Click 📸 Save Baseline.',
              ]} />

              <SubHeading>Comparing a Baseline</SubHeading>
              <Steps items={[
                'Click a saved baseline name in the panel.',
                'The Gantt chart shows a thin bar beneath each task showing the baseline dates.',
                'The variance table below the selector lists Start Variance and Finish Variance (in days) for every task.',
              ]} />
              <ul style={sc.ul}>
                <li style={sc.li}><strong style={{ color: '#dc2626' }}>Red (+N days)</strong> — task has slipped behind schedule.</li>
                <li style={sc.li}><strong style={{ color: '#16a34a' }}>Green (−N days)</strong> — task has improved vs baseline.</li>
                <li style={sc.li}><strong style={{ color: '#22c55e' }}>On track</strong> — no change.</li>
              </ul>

              <SubHeading>Deleting a Baseline</SubHeading>
              <Steps items={[
                'Click the ✕ button next to the baseline name.',
                'Confirm deletion.',
              ]} />
              <Note>Baselines are stored permanently until deleted. Save a new baseline before any major re-planning session.</Note>
            </Section>

            {/* WORKING CALENDAR */}
            <Section id="calendar" title="📆 Working Calendar">
              <p style={sc.p}>
                The scheduling engine uses the <strong>Working Calendar</strong> to skip weekends and public holidays when calculating dates and float values.
              </p>
              <p style={sc.p}>
                By default Monday–Friday are working days. Administrators can change company working days and add public holidays at <strong>Administration → Working Calendar</strong>.
              </p>
              <Note>Per-user calendars can be set at <strong>Administration → Users → Working Calendar</strong> to account for part-time workers or different time zones.</Note>
            </Section>

            {/* EVM */}
            <Section id="evm" title="📊 Earned Value Management (EVM)">
              <p style={sc.p}>
                The <strong>EVM panel</strong> appears on every Project, Program, and Portfolio detail page, and on the Dashboard. It gives a quantitative view of schedule and cost performance.
              </p>

              <SubHeading>Prerequisites</SubHeading>
              <p style={sc.p}>EVM requires tasks to have:</p>
              <ul style={sc.ul}>
                <li style={sc.li}>Start Date and Due Date set.</li>
                <li style={sc.li}>Resources assigned with <strong>Estimated Hours</strong> and <strong>Actual Hours</strong>.</li>
                <li style={sc.li}>User hourly rates set in Administration → Users.</li>
                <li style={sc.li}>% Complete updated as work progresses.</li>
              </ul>
              <Note>Milestone tasks (flagged as milestones in the task form) are automatically excluded from all EVM calculations, as they carry no budget or duration.</Note>

              <SubHeading>Key Metrics</SubHeading>
              <div style={sc.formula}>
                BAC  = Budget at Completion = Σ (Estimated Hours × Hourly Rate){'\n'}
                PV   = Planned Value (time-phased budget as of today){'\n'}
                EV   = Earned Value = BAC × % Complete{'\n'}
                AC   = Actual Cost = Σ (Actual Hours × Hourly Rate)
              </div>
              <ul style={sc.ul}>
                <li style={sc.li}><strong>CV (Cost Variance)</strong> = EV − AC. Negative = over budget.</li>
                <li style={sc.li}><strong>SV (Schedule Variance)</strong> = EV − PV. Negative = behind schedule.</li>
                <li style={sc.li}><strong>CPI (Cost Performance Index)</strong> = EV ÷ AC. Values below 1.0 mean each $1 spent is delivering less than $1 of value.</li>
                <li style={sc.li}><strong>SPI (Schedule Performance Index)</strong> = EV ÷ PV. Values below 1.0 mean work is progressing slower than planned.</li>
                <li style={sc.li}><strong>EAC (Estimate at Completion)</strong> = BAC ÷ CPI. Forecasted total cost based on current efficiency.</li>
                <li style={sc.li}><strong>ETC (Estimate to Complete)</strong> = EAC − AC. Budget still needed to finish.</li>
                <li style={sc.li}><strong>VAC (Variance at Completion)</strong> = BAC − EAC. Positive = under budget at completion.</li>
                <li style={sc.li}><strong>TCPI (To-Complete Performance Index)</strong> = (BAC − EV) ÷ (BAC − AC). The efficiency required on remaining work to meet BAC. Values above 1.1 signal the original budget is unlikely to be met.</li>
              </ul>

              <SubHeading>Health Status</SubHeading>
              <ul style={sc.ul}>
                <li style={sc.li}><strong style={{ color: '#16a34a' }}>On Track</strong> — CPI ≥ 0.95 and SPI ≥ 0.95.</li>
                <li style={sc.li}><strong style={{ color: '#d97706' }}>At Risk</strong> — CPI or SPI between 0.80 and 0.95.</li>
                <li style={sc.li}><strong style={{ color: '#dc2626' }}>Critical</strong> — CPI or SPI below 0.80.</li>
              </ul>

              <SubHeading>S-Curve Chart</SubHeading>
              <p style={sc.p}>The <strong>📈 S-Curve</strong> tab shows Planned Value (blue), Earned Value (green), and Actual Cost (amber) plotted month by month. A healthy project shows EV tracking closely to PV, with AC below EV.</p>

              <SubHeading>Task Detail Table</SubHeading>
              <p style={sc.p}>The <strong>📑 Task Detail</strong> tab breaks down all EVM metrics per task, allowing you to identify which specific tasks are driving cost or schedule overruns.</p>

              <Note>EVM data refreshes each time you open the panel. Click the ↻ button to force a refresh.</Note>
            </Section>

            {/* RESOURCING */}
            <Section id="resources" title="👥 Resourcing">
              <p style={sc.p}>Each task can have one or more team members assigned with estimated and actual hour allocations.</p>

              <SubHeading>Adding Resources to a Task</SubHeading>
              <Steps items={[
                'Open the task create or edit form.',
                'Click the Resourcing tab.',
                'Click + Add Resource.',
                'Select a team member from the dropdown.',
                'Enter Estimated Hours and Actual Hours.',
                'Enter an Allocation % (default 100%).',
                'Click Save.',
              ]} />

              <SubHeading>Over-Budget Calculation</SubHeading>
              <p style={sc.p}>When actual hours exceed estimated hours for any resource, that task appears in the Dashboard's <strong>Over Budget Tasks</strong> panel. The dollar overrun is calculated as:</p>
              <div style={sc.formula}>
                Cost Overrun = Σ (Actual Hours − Estimated Hours) × Hourly Rate
              </div>
              <p style={sc.p}>This is calculated per resource, so each team member's individual hourly rate is used. The user's hourly rate is set in <strong>Administration → Users</strong>.</p>
            </Section>

            {/* RISKS */}
            <Section id="risks" title="⚠️ Risks">
              <p style={sc.p}>Each task can have an associated risk record with probability, impact, and lifecycle status.</p>

              <SubHeading>Adding a Risk to a Task</SubHeading>
              <Steps items={[
                'Open the task create or edit form.',
                'Click the ⚠️ Risk tab.',
                'Enter a Risk Name (leave blank to skip adding a risk).',
                'Select a Risk Status: Open, Active, Mitigated, or Closed.',
                'Enter a Description.',
                'Set Probability (1–5) and Impact (1–5).',
                'The Risk Rate is automatically calculated as Probability × Impact.',
                'Add a Mitigation Plan.',
                'Click Save.',
              ]} />

              <SubHeading>Risk Ratings</SubHeading>
              <ul style={sc.ul}>
                <li style={sc.li}><strong>1–5:</strong> Low Risk</li>
                <li style={sc.li}><strong>6–10:</strong> Medium Risk</li>
                <li style={sc.li}><strong>11–15:</strong> High Risk — appears in Dashboard Risk Management panel</li>
                <li style={sc.li}><strong>16–25:</strong> Critical Risk — appears in Dashboard Risk Management panel</li>
              </ul>
              <Note>Tasks with a risk rating above 10 (High or Critical) appear in the Dashboard's <strong>High &amp; Critical Risk Tasks</strong> panel and on the <strong>Risk Management</strong> page. Milestone tasks are excluded.</Note>

              <SubHeading>Risk Status Values</SubHeading>
              <ul style={sc.ul}>
                <li style={sc.li}><strong>Open</strong> — risk identified, not yet being acted on.</li>
                <li style={sc.li}><strong>Active</strong> — risk is being actively monitored or mitigated.</li>
                <li style={sc.li}><strong>Mitigated</strong> — mitigation actions have been completed.</li>
                <li style={sc.li}><strong>Closed</strong> — risk is resolved or no longer relevant.</li>
              </ul>
            </Section>

            {/* RISK MANAGEMENT PAGE */}
            <Section id="risk-management" title="🛡️ Risk Management Page">
              <p style={sc.p}>The <strong>Risk Management</strong> page provides a consolidated, filterable view of every risk across all portfolios, programs, and projects. Navigate to <strong>Risk Management</strong> in the sidebar.</p>

              <SubHeading>Summary Chips</SubHeading>
              <p style={sc.p}>The top row shows counts for each risk level (Critical, High, Medium, Low). Click a chip to filter the table to that level. Click again to clear the filter.</p>

              <SubHeading>Filters</SubHeading>
              <ul style={sc.ul}>
                <li style={sc.li}><strong>Search</strong> — filter by task name, risk name, project, program, or portfolio.</li>
                <li style={sc.li}><strong>All Portfolios</strong> — restrict results to a specific portfolio.</li>
                <li style={sc.li}><strong>All Risk Levels</strong> — filter by risk level (Low / Medium / High / Critical).</li>
              </ul>

              <SubHeading>Table Columns</SubHeading>
              <ul style={sc.ul}>
                <li style={sc.li}><strong>Risk Level</strong> — colour-coded badge (Critical / High / Medium / Low).</li>
                <li style={sc.li}><strong>Task</strong> — the task name; clicking it navigates to the task's parent project or program.</li>
                <li style={sc.li}><strong>Risk Name</strong> — the name given to the risk.</li>
                <li style={sc.li}><strong>Rating</strong> — the numeric risk rate (Probability × Impact).</li>
                <li style={sc.li}><strong>P × I</strong> — the individual probability and impact scores.</li>
                <li style={sc.li}><strong>Project / Program / Portfolio</strong> — clickable breadcrumb links to each level of the hierarchy.</li>
                <li style={sc.li}><strong>Risk Status</strong> — lifecycle status: Open, Active, Mitigated, or Closed.</li>
                <li style={sc.li}><strong>Task Status</strong> — the current status of the associated task.</li>
              </ul>

              <SubHeading>Sorting</SubHeading>
              <p style={sc.p}>Click any column header to sort by that column. Click again to reverse the sort direction. Default sort is by Risk Rating (highest first).</p>

              <Note>The Risk Management page shows all risks regardless of their rating — not just High and Critical. Use the risk level filter or summary chips to focus on a specific tier.</Note>
            </Section>

            {/* CLICKUP */}
            <Section id="clickup" title="🔗 ClickUp Integration">
              <p style={sc.p}>Projects with a ClickUp ID linked can pull live task data, comments, and insights directly from ClickUp.</p>

              <SubHeading>Linking a Project to ClickUp</SubHeading>
              <Steps items={[
                'Edit the project.',
                'Enter the ClickUp Task ID in the ClickUp ID field (e.g. 869bc1qtm).',
                'Save the project.',
              ]} />

              <SubHeading>Viewing Detailed Insights</SubHeading>
              <Steps items={[
                'Open the Project detail page.',
                'Click the 🔍 Detailed Insights button (only visible when a ClickUp ID is set).',
                'The panel shows: comment summary, status, priority, due date, time estimates, checklist completion, risk indicators, and recent comments.',
              ]} />

              <SubHeading>Risk Signals</SubHeading>
              <p style={sc.p}>The insights panel automatically scans comments for risk keywords (blocked, delayed, overdue, etc.) and progress indicators (completed, deployed, approved, etc.) and highlights them.</p>

              <Note>The ClickUp integration requires a valid <code style={sc.code}>CLICKUP_MCP_TOKEN</code> set in the backend. Contact your system administrator if the Detailed Insights button returns an error.</Note>
            </Section>

            {/* ADMIN - USERS */}
            <Section id="admin-users" title="👤 Managing Users">
              <p style={sc.p}>Navigate to <strong>Administration → Users</strong>.</p>

              <SubHeading>Creating a User</SubHeading>
              <Steps items={[
                'Click + New User.',
                'Enter Username, Email, and Password.',
                'Select a Role.',
                'Select a Team (optional).',
                'Enter an Hourly Rate (used in over-budget calculations).',
                'Click Save.',
              ]} />

              <SubHeading>Editing a User</SubHeading>
              <Steps items={[
                'Click Edit next to any user.',
                'Update any fields. Leave the password blank to keep it unchanged.',
                'Click Save.',
              ]} />

              <SubHeading>Deleting a User</SubHeading>
              <Steps items={[
                'Click Delete next to any user.',
                'Confirm in the dialog.',
              ]} />
            </Section>

            {/* ADMIN - ROLES & PERMISSIONS */}
            <Section id="admin-roles" title="🔑 Roles & Permissions">
              <SubHeading>Roles</SubHeading>
              <p style={sc.p}>Navigate to <strong>Administration → Roles</strong> to create and manage roles. Each user is assigned one role.</p>
              <Steps items={[
                'Click + New Role.',
                'Enter a Role Name.',
                'Click Save.',
              ]} />

              <SubHeading>Permissions</SubHeading>
              <p style={sc.p}>Navigate to <strong>Administration → Permissions</strong> to set what each role can view or edit.</p>
              <Steps items={[
                'The permissions matrix shows every role as a column and every page/module as a row.',
                'Tick View to allow a role to see that section.',
                'Tick Edit to allow a role to create, update, and delete records in that section.',
                'Changes are saved automatically.',
              ]} />

              <Note>The <em>admin</em> role always has full access and its permissions cannot be restricted.</Note>
            </Section>

            {/* ADMIN - TEAMS */}
            <Section id="admin-teams" title="🏢 Teams">
              <p style={sc.p}>Teams are used to group users. Navigate to <strong>Administration → Teams</strong>.</p>

              <SubHeading>Creating a Team</SubHeading>
              <Steps items={[
                'Click + New Team.',
                'Enter a Team Name.',
                'Click Save.',
              ]} />

              <SubHeading>Editing a Team Name</SubHeading>
              <Steps items={[
                'Click the Edit (✏️) icon next to the team name.',
                'Type the new name in the inline input field.',
                'Click the ✓ tick to confirm, or ✕ to cancel.',
              ]} />

              <SubHeading>Deleting a Team</SubHeading>
              <Steps items={[
                'Click Delete next to any team.',
                'Confirm in the dialog.',
              ]} />
            </Section>

            {/* ADMIN - COMPANY SETUP */}
            <Section id="admin-company" title="🏷️ Company Setup">
              <p style={sc.p}>Navigate to <strong>Administration → Company Setup</strong> to customise the application branding.</p>

              <SubHeading>Setting the Company Name</SubHeading>
              <Steps items={[
                'Type your company name in the Company Name field.',
                'Click Save.',
                'The name appears centred below the logo in the sidebar.',
              ]} />

              <SubHeading>Uploading a Company Logo</SubHeading>
              <Steps items={[
                'Click Choose File under Company Logo.',
                'Select a JPEG, PNG, or GIF image.',
                'Maximum file size: 1 MB.',
                'A preview is shown immediately.',
                'Click Save to apply the logo.',
                'The logo appears in the top-left of the sidebar on every page.',
              ]} />

              <SubHeading>Removing the Logo</SubHeading>
              <Steps items={[
                'Click the Remove button below the logo preview.',
                'Click Save.',
              ]} />
            </Section>

            {/* ADMIN - WORKING CALENDAR */}
            <Section id="admin-calendar" title="📆 Working Calendar Admin">
              <p style={sc.p}>Navigate to <strong>Administration → Working Calendar</strong> to configure company-wide scheduling rules.</p>

              <SubHeading>Setting Working Days</SubHeading>
              <Steps items={[
                'Click each day button (Mon–Sun) to toggle it on or off.',
                'Green (highlighted) days are treated as working days.',
                'Default is Monday–Friday.',
                'Click Save Calendar Settings.',
              ]} />

              <SubHeading>Hours Per Day</SubHeading>
              <p style={sc.p}>Set the standard working hours per day (default 8). This is used to convert between hours and working days in EVM calculations.</p>

              <SubHeading>Timezone</SubHeading>
              <p style={sc.p}>Enter a timezone identifier (e.g. <code style={sc.code}>America/New_York</code>, <code style={sc.code}>Australia/Sydney</code>). This is used when interpreting date boundaries.</p>

              <SubHeading>Public Holidays</SubHeading>
              <Steps items={[
                'Enter the holiday date and name.',
                'Tick "Recurring (annual)" to apply the holiday every year on the same date.',
                'Click + Add Holiday.',
                'The holiday appears in the list below.',
                'Click ✕ to delete a holiday.',
              ]} />
              <Note>Public holidays are skipped when the scheduling engine calculates working-day durations and float values.</Note>
            </Section>

            {/* REPORTS */}
            <Section id="reports" title="📊 Reports">
              <p style={sc.p}>The <strong>Reports</strong> page generates printable, PDF-exportable summaries of your portfolio data. Navigate to <strong>Reports</strong> in the sidebar.</p>

              <SubHeading>How to Generate a Report</SubHeading>
              <Steps items={[
                'Click the report type you want from the 9-card grid at the top.',
                'If the report supports multiple scope types (portfolio / program / project), select one from the Scope Type dropdown.',
                'Choose the specific portfolio, program, or project from the next dropdown.',
                'Click ▶ Generate Report.',
                'The report renders below the controls.',
                'Click 🖨 Print / Export PDF to open the browser print dialog — choose "Save as PDF" to export.',
              ]} />

              <SubHeading>Available Reports</SubHeading>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    {['Report', 'Scope', 'What it shows'].map(h => (
                      <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['📊 Portfolio Status',     'Portfolio',              'Executive summary: EVM KPIs, task counts, program list with progress'],
                    ['📋 Program Report',       'Program',                'Program health, project list, EVM summary, top risks'],
                    ['🗂️ Project Report',        'Project',                'Full project detail: tasks table, EVM, resource utilisation, risk register'],
                    ['📈 EVM Performance',      'Portfolio/Program/Project','All EVM metrics with formulas, S-curve chart, per-task EVM table'],
                    ['📅 Schedule Variance',    'Portfolio/Program/Project','Baseline vs actual dates, days early/late per task (requires saved baseline)'],
                    ['👥 Resource Utilisation', 'Portfolio/Program/Project','Per-user hours & costs, utilisation %, over-budget flagging'],
                    ['⚠️ Risk Register',        'Portfolio/Program/Project','Risk heat map, all risks ranked by rate with mitigation plans'],
                    ['💰 Over-Budget',          'Portfolio/Program/Project','Tasks where actual cost exceeds earned value, with overrun amounts'],
                    ['✅ Task Status',          'Portfolio/Program/Project','Full task list with status, dates, completion bar; filterable & sortable'],
                  ].map(([report, scope, desc], i) => (
                    <tr key={report} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600, borderBottom: '1px solid #f3f4f6' }}>{report}</td>
                      <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6', color: '#6b7280', whiteSpace: 'nowrap' }}>{scope}</td>
                      <td style={{ padding: '0.5rem 0.75rem', borderBottom: '1px solid #f3f4f6', color: '#374151' }}>{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <SubHeading>Printing & PDF Export</SubHeading>
              <p style={sc.p}>All reports are print-optimised. When you click <strong>🖨 Print / Export PDF</strong>, the browser print dialog opens. To save as PDF:</p>
              <Steps items={[
                'In the print dialog, set the Destination to "Save as PDF".',
                'Set paper size to A4 or Letter.',
                'Disable headers and footers if you want a clean layout.',
                'Click Save.',
              ]} />
              <Note>The report controls (type picker, scope selectors) are automatically hidden when printing — only the report content is included.</Note>

              <SubHeading>Schedule Variance Report — Baselines</SubHeading>
              <p style={sc.p}>The Schedule Variance report requires at least one saved baseline. To create one, open any Gantt view (project / program / portfolio detail) and use the Baselines panel below the chart to save a named snapshot. See the <strong>📐 Schedule Baselines</strong> section for details.</p>
            </Section>

            {/* RESOURCE CAPACITY */}
            <Section id="capacity" title="👥 Resource Capacity Planning">
              <p style={sc.p}>The <strong>Capacity</strong> page shows a colour-coded heatmap of how many hours each resource is allocated week-by-week compared to their working capacity. Navigate to <strong>Capacity</strong> in the sidebar.</p>

              <SubHeading>Reading the Heatmap</SubHeading>
              <p style={sc.p}>Each row is a resource (team member). Each column is a week (or month). The cell value shows allocated hours and utilisation percentage:</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                <thead>
                  <tr style={{ background: '#f3f4f6' }}>
                    {['Colour', 'Utilisation', 'Meaning'].map(h => (
                      <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontSize: '0.78rem', fontWeight: 700, color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['#dcfce7', '≤ 50%',    'Under-utilised — resource has spare capacity'],
                    ['#86efac', '51–80%',   'Well utilised — comfortable allocation'],
                    ['#fef3c7', '81–100%',  'Near capacity — monitor closely'],
                    ['#fed7aa', '101–120%', 'Over-allocated — consider redistributing tasks'],
                    ['#fca5a5', '> 120%',   'Severely over-allocated — action required'],
                  ].map(([bg, util, meaning], i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#f9fafb' }}>
                      <td style={{ padding: '0.4rem 0.75rem', borderBottom: '1px solid #f3f4f6' }}>
                        <div style={{ width: '40px', height: '20px', background: bg, borderRadius: '4px', border: '1px solid rgba(0,0,0,0.1)' }} />
                      </td>
                      <td style={{ padding: '0.4rem 0.75rem', fontWeight: 600, borderBottom: '1px solid #f3f4f6' }}>{util}</td>
                      <td style={{ padding: '0.4rem 0.75rem', color: '#374151', borderBottom: '1px solid #f3f4f6' }}>{meaning}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <SubHeading>How Capacity is Calculated</SubHeading>
              <p style={sc.p}>For each task resource assignment, the <code style={sc.code}>estimated_hours</code> are distributed evenly across the working days of the task's duration. The working calendar (Mon–Fri default, set in Working Calendar Admin) determines which days count.</p>
              <p style={sc.p}>Weekly capacity = <code style={sc.code}>hours_per_day × working_days_in_week</code> (default 8h × 5 days = 40h/week).</p>

              <SubHeading>Controls</SubHeading>
              <Steps items={[
                'Set a From / To date range (defaults to the current week through 11 weeks ahead).',
                'Optionally filter by Scope (Portfolio / Program / Project) to see only resources allocated within that scope.',
                'Toggle between Weeks and Months view using the buttons in the top-right.',
                'Click ↻ Load to refresh the heatmap.',
              ]} />

              <SubHeading>Drilling Down</SubHeading>
              <p style={sc.p}>Click any coloured cell to open a popup showing:</p>
              <Steps items={[
                'Total allocated hours and capacity for that week.',
                'Utilisation percentage with a progress bar.',
                'A breakdown of every task contributing hours to that week, sorted by hours descending.',
              ]} />

              <SubHeading>Totals Row</SubHeading>
              <p style={sc.p}>The <strong>Total</strong> row at the bottom sums allocated and capacity hours across all resources for each week, giving an organisation-wide view of demand vs. supply.</p>

              <Note>Capacity is based on <strong>estimated hours</strong> from resource assignments, not actual hours logged. Use the Timesheets feature (when available) for actuals-based capacity tracking.</Note>
            </Section>

            <div style={{ height: '4rem' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const sc = {
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', justifyContent: 'flex-end' },
  panel:       { width: '860px', maxWidth: '100vw', background: '#fff', display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 40px rgba(0,0,0,0.2)', animation: 'slideInRight 0.25s ease' },
  header:      { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '1.25rem 1.5rem', background: '#0A2B14', color: '#fff', flexShrink: 0 },
  headerTitle: { fontSize: '1.15rem', fontWeight: 800 },
  headerSub:   { fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginTop: '2px' },
  closeBtn:    { background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontSize: '1rem', width: '32px', height: '32px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  body:        { display: 'flex', flex: 1, overflow: 'hidden' },
  toc:         { width: '210px', flexShrink: 0, background: '#f9fafb', borderRight: '1px solid #e5e7eb', overflowY: 'auto', padding: '0.75rem 0' },
  tocTitle:    { fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', padding: '0.25rem 1rem 0.5rem' },
  tocItem:     { display: 'block', width: '100%', padding: '0.45rem 1rem', background: 'none', border: 'none', textAlign: 'left', fontSize: '0.82rem', color: '#374151', cursor: 'pointer', borderLeft: '3px solid transparent' },
  tocActive:   { background: '#f0fdf4', color: '#016D2D', fontWeight: 700, borderLeft: '3px solid #016D2D' },
  content:     { flex: 1, overflowY: 'auto', padding: '1.5rem 2rem' },
  section:     { marginBottom: '2.5rem', scrollMarginTop: '1rem' },
  h2:          { fontSize: '1.2rem', fontWeight: 800, color: '#0A2B14', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: '2px solid #d1fae5' },
  h3:          { fontSize: '0.95rem', fontWeight: 700, color: '#1d1d1d', marginTop: '1.1rem', marginBottom: '0.4rem' },
  p:           { fontSize: '0.88rem', color: '#374151', lineHeight: 1.7, margin: '0 0 0.5rem' },
  ol:          { paddingLeft: '1.4rem', margin: '0.4rem 0 0.75rem' },
  ul:          { paddingLeft: '1.4rem', margin: '0.4rem 0 0.75rem' },
  li:          { fontSize: '0.87rem', color: '#374151', lineHeight: 1.65, marginBottom: '0.3rem' },
  note:        { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', padding: '0.6rem 0.9rem', fontSize: '0.84rem', color: '#166534', marginTop: '0.75rem' },
  warn:        { background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '6px', padding: '0.6rem 0.9rem', fontSize: '0.84rem', color: '#92400e', marginTop: '0.75rem' },
  hierarchy:   { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', margin: '0.5rem 0 0.75rem' },
  hLevel:      { display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.87rem', color: '#374151' },
  hIcon:       { fontSize: '1rem', flexShrink: 0 },
  formula:     { background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '0.6rem 1rem', fontFamily: 'monospace', fontSize: '0.86rem', color: '#1d1d1d', margin: '0.5rem 0' },
  code:        { background: '#f3f4f6', padding: '1px 5px', borderRadius: '3px', fontFamily: 'monospace', fontSize: '0.82rem' },
};
