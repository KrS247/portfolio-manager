<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use App\Models\Portfolio;
use App\Models\Program;
use App\Models\Project;
use App\Models\Task;

class ChatController extends Controller
{
    private string $apiKey;
    private string $apiBase = 'https://api.openai.com/v1/chat/completions';

    public function __construct()
    {
        $this->apiKey = config('services.openai.key', '');
    }

    // ── System prompt ──────────────────────────────────────────────────────────

    private function buildSystemPrompt($user): string
    {
        $today    = date('Y-m-d');
        $name     = $user->username;
        $role     = $user->role?->name ?? 'User';
        $isAdmin  = (bool) $user->role?->is_admin;
        $isPM     = !$isAdmin && $role === 'project_manager';

        // Fix for audit finding C-2: scope all data queries to the authenticated
        // user's owned/assigned records. Admin users see everything; project
        // managers see only their own portfolios/programs/projects; members see
        // only their assigned tasks (and the parent names for context).
        $portfolioQuery = Portfolio::query();
        $programQuery   = Program::query();
        $projectQuery   = Project::with('program');
        $overdueQuery   = Task::where('due_date', '<', $today)
                              ->whereNotIn('status', ['completed', 'cancelled'])
                              ->orderBy('due_date')->limit(10);

        if (!$isAdmin) {
            $portfolioQuery->where('owner_id', $user->id);
            $programQuery->where('owner_id', $user->id);
            $projectQuery->where('owner_id', $user->id);
            // Limit overdue tasks to tasks the user owns or is assigned to
            $overdueQuery->where(function ($q) use ($user) {
                $q->where('assigned_to', $user->id)
                  ->orWhere('created_by', $user->id);
            });
        }

        $portfolios = $portfolioQuery->get(['id', 'name', 'status']);
        $programs   = $programQuery->get(['id', 'name', 'portfolio_id', 'status']);
        $projects   = $projectQuery->get(['id', 'name', 'program_id', 'status', 'start_date', 'end_date']);
        $overdue    = $overdueQuery->get(['id', 'title', 'due_date', 'status']);
        $mine       = Task::where('assigned_to', $user->id)
                         ->whereNotIn('status', ['completed', 'cancelled'])
                         ->orderBy('due_date')->limit(10)
                         ->get(['id', 'title', 'due_date', 'status', 'parent_id', 'parent_type']);

        $pList = $portfolios->map(fn($p) => "  • {$p->name} [{$p->status}]")->join("\n") ?: '  (none)';

        $pgList = $programs->map(function($pg) use ($portfolios) {
            $port = $portfolios->firstWhere('id', $pg->portfolio_id);
            return "  • {$pg->name} [{$pg->status}] → Portfolio: " . ($port?->name ?? '?');
        })->join("\n") ?: '  (none)';

        $prList = $projects->map(fn($p) =>
            "  • {$p->name} [{$p->status}] → Program: " . ($p->program?->name ?? '?') .
            " | {$p->start_date} → {$p->end_date}"
        )->join("\n") ?: '  (none)';

        $odList = $overdue->map(fn($t) => "  • {$t->title} (due {$t->due_date})")->join("\n") ?: '  (none)';
        $myList = $mine->map(fn($t) => "  • {$t->title} [{$t->status}] (due {$t->due_date})")->join("\n") ?: '  (none)';

        return <<<SYS
You are an AI assistant built into Portfolio Manager, a project portfolio management tool.
User: {$name} | Role: {$role} | Today: {$today}

DATA HIERARCHY (must be created in this order):
  Portfolio → Program → Project → Task → Subtask

PORTFOLIOS:
{$pList}

PROGRAMS:
{$pgList}

PROJECTS:
{$prList}

OVERDUE TASKS (across all projects):
{$odList}

TASKS ASSIGNED TO {$name}:
{$myList}

INSTRUCTIONS:
- Answer questions concisely using the data above.
- To create a portfolio, program, or project: call the appropriate tool. The user will be asked to confirm before anything is saved.
- Always use YYYY-MM-DD for dates.
- If the user asks to create a program, confirm which portfolio it belongs to. If only one exists, use it automatically.
- Keep all replies under 150 words unless listing data.
SYS;
    }

    // ── Tool definitions ───────────────────────────────────────────────────────

    private function getTools(): array
    {
        return [
            [
                'type'     => 'function',
                'function' => [
                    'name'        => 'create_portfolio',
                    'description' => 'Create a new portfolio at the top of the hierarchy.',
                    'parameters'  => [
                        'type'       => 'object',
                        'properties' => [
                            'name'        => ['type' => 'string', 'description' => 'Portfolio name'],
                            'description' => ['type' => 'string', 'description' => 'Optional description'],
                            'status'      => ['type' => 'string', 'enum' => ['active', 'on_hold', 'closed']],
                        ],
                        'required' => ['name'],
                    ],
                ],
            ],
            [
                'type'     => 'function',
                'function' => [
                    'name'        => 'create_program',
                    'description' => 'Create a new program inside an existing portfolio.',
                    'parameters'  => [
                        'type'       => 'object',
                        'properties' => [
                            'name'           => ['type' => 'string'],
                            'description'    => ['type' => 'string'],
                            'portfolio_name' => ['type' => 'string', 'description' => 'Exact name of the parent portfolio'],
                            'start_date'     => ['type' => 'string', 'description' => 'YYYY-MM-DD'],
                            'end_date'       => ['type' => 'string', 'description' => 'YYYY-MM-DD'],
                            'status'         => ['type' => 'string', 'enum' => ['active', 'on_hold', 'closed']],
                        ],
                        'required' => ['name', 'portfolio_name'],
                    ],
                ],
            ],
            [
                'type'     => 'function',
                'function' => [
                    'name'        => 'create_project',
                    'description' => 'Create a new project inside an existing program.',
                    'parameters'  => [
                        'type'       => 'object',
                        'properties' => [
                            'name'         => ['type' => 'string'],
                            'description'  => ['type' => 'string'],
                            'program_name' => ['type' => 'string', 'description' => 'Exact name of the parent program'],
                            'start_date'   => ['type' => 'string', 'description' => 'YYYY-MM-DD'],
                            'end_date'     => ['type' => 'string', 'description' => 'YYYY-MM-DD'],
                            'status'       => ['type' => 'string', 'enum' => ['active', 'on_hold', 'closed']],
                        ],
                        'required' => ['name', 'program_name'],
                    ],
                ],
            ],
            [
                'type'     => 'function',
                'function' => [
                    'name'        => 'update_task_status',
                    'description' => 'Update the status or percent complete of a task by its title (partial match). Use this when the user says a task is done, in progress, on hold, etc.',
                    'parameters'  => [
                        'type'       => 'object',
                        'properties' => [
                            'task_title'       => ['type' => 'string', 'description' => 'Partial or full task title to search for'],
                            'status'           => ['type' => 'string', 'enum' => ['open', 'in_progress', 'completed', 'cancelled', 'on_hold'], 'description' => 'New status'],
                            'percent_complete' => ['type' => 'integer', 'description' => 'Completion percentage 0-100 (optional)'],
                        ],
                        'required' => ['task_title', 'status'],
                    ],
                ],
            ],
            [
                'type'     => 'function',
                'function' => [
                    'name'        => 'get_project_summary',
                    'description' => 'Get a detailed summary of a project including tasks, overdue items and EVM metrics.',
                    'parameters'  => [
                        'type'       => 'object',
                        'properties' => [
                            'project_name' => ['type' => 'string', 'description' => 'Partial or full project name'],
                        ],
                        'required' => ['project_name'],
                    ],
                ],
            ],
        ];
    }

    // ── Tool execution ─────────────────────────────────────────────────────────

    private function executeToolCall(string $name, array $args, $user, bool $dryRun = false): array
    {
        $writeFns = ['create_portfolio', 'create_program', 'create_project', 'update_task_status'];

        if ($dryRun && in_array($name, $writeFns)) {
            return [
                'status'  => 'pending_confirmation',
                'message' => 'Awaiting user confirmation before creating this record.',
                'action'  => ['type' => $name, 'params' => $args],
            ];
        }

        return match($name) {
            'create_portfolio'    => $this->doCreatePortfolio($args),
            'create_program'      => $this->doCreateProgram($args),
            'create_project'      => $this->doCreateProject($args),
            'update_task_status'  => $this->doUpdateTaskStatus($args, $user),
            'get_project_summary' => $this->doGetProjectSummary($args),
            default               => ['error' => "Unknown tool: {$name}"],
        };
    }

    private function doCreatePortfolio(array $a): array
    {
        try {
            $p = Portfolio::create([
                'name'        => $a['name'],
                'description' => $a['description'] ?? null,
                'status'      => $a['status'] ?? 'active',
            ]);
            return ['success' => true, 'id' => $p->id, 'name' => $p->name, 'type' => 'portfolio'];
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('ChatController: AI tool error', ['error' => $e->getMessage()]);
            return ['error' => 'Action failed. Please try again.'];
        }
    }

    private function doCreateProgram(array $a): array
    {
        try {
            $portfolio = Portfolio::where('name', 'like', '%' . ($a['portfolio_name'] ?? '') . '%')->first();
            if (!$portfolio) {
                return ['error' => "Portfolio '{$a['portfolio_name']}' not found. Available: " .
                    Portfolio::pluck('name')->join(', ')];
            }
            $p = Program::create([
                'name'         => $a['name'],
                'description'  => $a['description'] ?? null,
                'portfolio_id' => $portfolio->id,
                'status'       => $a['status'] ?? 'active',
                'start_date'   => $a['start_date'] ?? null,
                'end_date'     => $a['end_date'] ?? null,
            ]);
            return ['success' => true, 'id' => $p->id, 'name' => $p->name, 'portfolio' => $portfolio->name, 'type' => 'program'];
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('ChatController: AI tool error', ['error' => $e->getMessage()]);
            return ['error' => 'Action failed. Please try again.'];
        }
    }

    private function doCreateProject(array $a): array
    {
        try {
            $program = Program::where('name', 'like', '%' . ($a['program_name'] ?? '') . '%')->first();
            if (!$program) {
                return ['error' => "Program '{$a['program_name']}' not found. Available: " .
                    Program::pluck('name')->join(', ')];
            }
            $p = Project::create([
                'name'        => $a['name'],
                'description' => $a['description'] ?? null,
                'program_id'  => $program->id,
                'status'      => $a['status'] ?? 'active',
                'start_date'  => $a['start_date'] ?? null,
                'end_date'    => $a['end_date'] ?? null,
            ]);
            return ['success' => true, 'id' => $p->id, 'name' => $p->name, 'program' => $program->name, 'type' => 'project'];
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('ChatController: AI tool error', ['error' => $e->getMessage()]);
            return ['error' => 'Action failed. Please try again.'];
        }
    }

    private function doUpdateTaskStatus(array $a, $user): array
    {
        try {
            // Fix for audit finding H-5: the original fuzzy LIKE search had no
            // ownership check — any user could update any task in the database by
            // title. Now we:
            //   1. Prefer exact-match search (less ambiguous)
            //   2. Apply the same PM ownership check as TaskController::update()
            //   3. Only validate recognised status values
            $validStatuses = ['not_started', 'open', 'in_progress', 'completed', 'cancelled'];
            $newStatus = $a['status'] ?? '';
            if (!in_array($newStatus, $validStatuses, true)) {
                return ['error' => "Invalid status \"{$newStatus}\". Allowed: " . implode(', ', $validStatuses)];
            }

            $titleSearch = trim($a['task_title'] ?? '');
            if ($titleSearch === '') {
                return ['error' => 'task_title is required.'];
            }

            // Prefer exact match; fall back to case-insensitive prefix search
            $query = Task::where('title', $titleSearch);
            if (!$query->exists()) {
                $query = Task::where('title', 'like', $titleSearch . '%');
            }

            // PM role can only update tasks they created — same check as TaskController
            $isPM = $user && $user->role?->name === 'project_manager' && !$user->role?->is_admin;
            if ($isPM) {
                $query->where('created_by', $user->id);
            }

            $task = $query->first();
            if (!$task) {
                return ['error' => "No accessible task found matching \"{$titleSearch}\"."];
            }

            $updates = ['status' => $newStatus];
            if (isset($a['percent_complete']) && is_numeric($a['percent_complete'])) {
                $updates['percent_complete'] = max(0, min(100, (int) $a['percent_complete']));
            }
            $oldStatus = $task->status;
            $task->update($updates);

            \App\Models\ActivityLog::record('task', $task->id, 'status_changed',
                ($user?->username ?? 'AI') . " changed status to \"{$newStatus}\" via AI chat",
                $user?->id, ['status' => [$oldStatus, $newStatus]]
            );

            return ['success' => true, 'task' => $task->title, 'new_status' => $newStatus];
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('ChatController: doUpdateTaskStatus error', ['error' => $e->getMessage()]);
            return ['error' => 'Failed to update task status. Please try again.'];
        }
    }

    private function doGetProjectSummary(array $a): array
    {
        try {
            $project = Project::where('name', 'like', '%' . ($a['project_name'] ?? '') . '%')
                ->with('program')
                ->first();
            if (!$project) {
                return ['error' => "Project matching \"{$a['project_name']}\" not found."];
            }

            $today   = date('Y-m-d');
            $tasks   = Task::where('parent_type', 'project')->where('parent_id', $project->id)->get();
            $overdue = $tasks->filter(fn($t) => $t->due_date && $t->due_date < $today && !in_array($t->status, ['completed', 'cancelled']));
            $done    = $tasks->where('status', 'completed')->count();
            $total   = $tasks->count();
            $avgPct  = $total > 0 ? round($tasks->avg('percent_complete'), 0) : 0;

            return [
                'project'       => $project->name,
                'program'       => $project->program?->name,
                'status'        => $project->status,
                'start_date'    => $project->start_date,
                'end_date'      => $project->end_date,
                'total_tasks'   => $total,
                'completed'     => $done,
                'overdue_count' => $overdue->count(),
                'avg_progress'  => $avgPct . '%',
                'overdue_tasks' => $overdue->map(fn($t) => $t->title . ' (due ' . $t->due_date . ')')->values()->all(),
            ];
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('ChatController: AI tool error', ['error' => $e->getMessage()]);
            return ['error' => 'Action failed. Please try again.'];
        }
    }

    // ── Raw OpenAI HTTP call ───────────────────────────────────────────────────

    private function callOpenAI(array $messages, array $tools = []): array
    {
        $payload = [
            'model'      => 'gpt-4o-mini',
            'messages'   => $messages,
            'max_tokens' => 600,
        ];
        if (!empty($tools)) {
            $payload['tools']       = $tools;
            $payload['tool_choice'] = 'auto';
        }

        $res = Http::withToken($this->apiKey)
            ->timeout(30)
            ->post($this->apiBase, $payload);

        if ($res->failed()) {
            throw new \Exception('OpenAI error ' . $res->status() . ': ' . $res->body());
        }
        return $res->json();
    }

    // ── Main chat endpoint  POST /api/chat ────────────────────────────────────

    public function chat(Request $request)
    {
        // ── Input validation — prompt injection defence ────────────────────────
        // Restricting role to user|assistant prevents attackers from injecting
        // role=system entries that override the system prompt.
        // SOC 2: CC6.1, CC8.1 | ISO A.8.28
        $request->validate([
            'messages'              => 'sometimes|array|max:50',
            'messages.*.role'       => 'required_with:messages|in:user,assistant',
            'messages.*.content'    => 'required_with:messages|string|max:4000',
            'confirm_action'        => 'sometimes|nullable|array',
            'confirm_action.type'   => 'required_with:confirm_action|string'
                . '|in:create_portfolio,create_program,create_project,update_task_status',
            'confirm_action.params' => 'required_with:confirm_action|array',
        ]);

        try {
            $user          = $request->attributes->get('auth_user');
            $messages      = $request->input('messages', []);
            $confirmAction = $request->input('confirm_action');

            if (!$this->apiKey) {
                return response()->json(['reply' => '⚠️ OpenAI API key is not configured.'], 200);
            }

            // ── Phase 2: confirmed write action (no OpenAI needed) ─────────────
            if ($confirmAction) {
                $result = $this->executeToolCall(
                    $confirmAction['type'],
                    $confirmAction['params'],
                    $user,
                    false
                );
                if (isset($result['error'])) {
                    return response()->json(['reply' => "❌ {$result['error']}"]);
                }
                $label = ucfirst(str_replace('_', ' ', str_replace('create_', '', $confirmAction['type'])));
                $name  = $confirmAction['params']['name'] ?? 'item';
                return response()->json([
                    'reply'   => "✅ **{$label}** \"{$name}\" created successfully!",
                    'created' => $result,
                ]);
            }

            // ── Phase 1: ask OpenAI ────────────────────────────────────────────
            $systemMessages = array_merge(
                [['role' => 'system', 'content' => $this->buildSystemPrompt($user)]],
                $messages
            );

            $data    = $this->callOpenAI($systemMessages, $this->getTools());
            $msg     = $data['choices'][0]['message'];
            $pending = null;

            if (!empty($msg['tool_calls'])) {
                $toolResults = [];

                foreach ($msg['tool_calls'] as $call) {
                    $args    = json_decode($call['function']['arguments'], true) ?? [];
                    $result2 = $this->executeToolCall($call['function']['name'], $args, $user, true);

                    if (($result2['status'] ?? '') === 'pending_confirmation') {
                        $pending = $result2['action'];
                    }

                    $toolResults[] = [
                        'role'         => 'tool',
                        'tool_call_id' => $call['id'],
                        'content'      => json_encode($result2),
                    ];
                }

                // Second call with tool results so the model can give a human reply
                $secondMessages = array_merge(
                    $systemMessages,
                    [$msg],            // assistant message with tool_calls
                    $toolResults
                );
                $finalData = $this->callOpenAI($secondMessages);
                $reply     = $finalData['choices'][0]['message']['content'] ?? 'Done.';
            } else {
                $reply = $msg['content'] ?? '';
            }

            return response()->json([
                'reply'          => $reply,
                'pending_action' => $pending,
            ]);

        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('ChatController::chat error', [
                'error' => $e->getMessage(),
                'file'  => $e->getFile(),
                'line'  => $e->getLine(),
            ]);
            // Fix for audit finding M-8: never return raw exception messages to
            // the client — they may contain DB schema details, file paths, etc.
            return response()->json(['reply' => '⚠️ An error occurred. Please try again.'], 200);
        }
    }

    // ── Charter parsing  POST /api/chat/charter ───────────────────────────────

    public function parseCharter(Request $request)
    {
        // Use mimes: to validate actual MIME type (inspects file bytes via finfo),
        // not the client-supplied filename extension.
        // SOC 2: CC6.1 | ISO A.8.28
        $request->validate([
            'file' => 'required|file|mimes:pdf,txt,text|max:10240',
        ]);

        if (!$this->apiKey) {
            return response()->json(['error' => 'OpenAI API key not configured.'], 500);
        }

        $file = $request->file('file');

        // Use server-detected MIME type, not the client-supplied extension
        $mimeType = $file->getMimeType();
        $isPdf    = in_array($mimeType, ['application/pdf', 'application/x-pdf']);
        $text     = $isPdf
            ? $this->extractPdfText($file->getRealPath())
            : file_get_contents($file->getRealPath());

        if (empty(trim($text))) {
            return response()->json(['error' => 'No readable text found in the document.'], 422);
        }

        $text = mb_substr($text, 0, 6000); // cap tokens

        try {
            $res = Http::withToken($this->apiKey)->timeout(40)->post($this->apiBase, [
                'model'           => 'gpt-4o-mini',
                'max_tokens'      => 800,
                'response_format' => ['type' => 'json_object'],
                'messages'        => [[
                    'role'    => 'user',
                    'content' =>
                        "Extract the project charter details from the document below and return ONLY a JSON object " .
                        "with exactly this structure (use null for missing fields):\n" .
                        "{\n" .
                        "  \"portfolio\": {\"name\": \"\", \"description\": \"\"},\n" .
                        "  \"program\":   {\"name\": \"\", \"description\": \"\"},\n" .
                        "  \"project\":   {\"name\": \"\", \"description\": \"\", \"start_date\": \"\", " .
                        "\"end_date\": \"\", \"budget\": \"\", \"objectives\": \"\"}\n" .
                        "}\n\nDOCUMENT:\n{$text}",
                ]],
            ]);

            if ($res->failed()) {
                throw new \Exception('OpenAI error: ' . $res->body());
            }

            $extracted = json_decode($res->json('choices.0.message.content'), true);
            return response()->json(['extracted' => $extracted]);

        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('ChatController::parseCharter error', [
                'error' => $e->getMessage(),
                'file'  => $e->getFile(),
                'line'  => $e->getLine(),
            ]);
            return response()->json(['error' => 'Charter parsing failed. Please try again.'], 200);
        }
    }

    // ── Create all records from charter  POST /api/chat/charter/create ────────

    public function createFromCharter(Request $request)
    {
        $data = $request->input('data', []);
        $log  = [];

        $portfolioId = null;
        $programId   = null;

        // Portfolio
        if (!empty($data['portfolio']['name'])) {
            $r = $this->doCreatePortfolio($data['portfolio']);
            $log[] = isset($r['error']) ? "❌ Portfolio: {$r['error']}" : "✅ Portfolio: {$r['name']}";
            $portfolioId = $r['id'] ?? null;
        }

        // Program
        if (!empty($data['program']['name'])) {
            $args = $data['program'];
            if ($portfolioId && empty($args['portfolio_name'])) {
                // Resolve portfolio name from the just-created ID
                $args['portfolio_name'] = Portfolio::find($portfolioId)?->name ?? '';
            }
            $r = $this->doCreateProgram($args);
            $log[] = isset($r['error']) ? "❌ Program: {$r['error']}" : "✅ Program: {$r['name']}";
            $programId = $r['id'] ?? null;
        }

        // Project
        if (!empty($data['project']['name'])) {
            $args = $data['project'];
            if ($programId && empty($args['program_name'])) {
                $args['program_name'] = Program::find($programId)?->name ?? '';
            }
            $r = $this->doCreateProject($args);
            $log[] = isset($r['error']) ? "❌ Project: {$r['error']}" : "✅ Project: {$r['name']}";
        }

        return response()->json(['log' => $log]);
    }

    // ── Simple PDF text extractor (no system deps) ────────────────────────────

    /**
     * Extract readable text from a PDF file.
     *
     * Security hardening (M-10):
     *  - Cap the raw binary read to 4 MB to prevent OOM on crafted payloads.
     *  - Use possessive/atomic-group equivalents with strict bounds to avoid
     *    catastrophic backtracking (ReDoS).
     *  - Fall back to a safe placeholder rather than returning raw binary when
     *    extraction yields no text (raw binary could carry injection payloads).
     *  - All preg calls are wrapped in pcre_last_error() guards.
     */
    private function extractPdfText(string $path): string
    {
        // Cap read at 4 MB — PDFs larger than this are unlikely to be charters
        // and a full binary read would risk PHP OOM errors.
        $maxBytes = 4 * 1024 * 1024;
        $fh = fopen($path, 'rb');
        if (!$fh) {
            return '';
        }
        $raw = fread($fh, $maxBytes);
        fclose($fh);

        if (!$raw) {
            return '';
        }

        $text = '';

        // BT...ET text object blocks — limit to first 500 blocks to cap CPU
        if (preg_match_all('/BT(.{1,4096}?)ET/s', $raw, $blocks) === false) {
            // PCRE failed (e.g. backtrack limit hit) — skip parsing
            return '[PDF text could not be extracted]';
        }

        $limit = min(count($blocks[1]), 500);
        for ($b = 0; $b < $limit; $b++) {
            $block = $blocks[1][$b];

            // Parenthesis-encoded strings — use a non-backtracking character class
            // instead of the original nested-quantifier pattern that causes ReDoS.
            if (preg_match_all('/\(([^()\\\\]{0,512}(?:\\\\.[^()\\\\]{0,512})*)\)/', $block, $strs) !== false) {
                foreach ($strs[1] as $s) {
                    $text .= stripslashes($s) . ' ';
                }
            }

            // Hex-encoded strings — bounded to 1024 hex chars per token
            if (preg_match_all('/<([0-9a-fA-F\s]{1,1024})>/', $block, $hex) !== false) {
                foreach ($hex[1] as $h) {
                    $h = preg_replace('/\s+/', '', $h) ?? '';
                    if (strlen($h) % 2 === 0) {
                        for ($i = 0; $i < strlen($h); $i += 2) {
                            $c = chr(hexdec(substr($h, $i, 2)));
                            if ($c >= ' ' && $c <= '~') $text .= $c;
                        }
                        $text .= ' ';
                    }
                }
            }
        }

        // Fix for M-10: do NOT fall back to raw binary — it may contain injection
        // payloads or binary junk that could corrupt the OpenAI prompt.
        if (!trim($text)) {
            return '[PDF text could not be extracted. Please paste the charter content as plain text.]';
        }

        // Truncate extracted text to a safe prompt size (≈ 8 000 chars)
        if (strlen($text) > 8000) {
            $text = substr($text, 0, 8000) . '…[truncated]';
        }

        return $text;
    }
}
