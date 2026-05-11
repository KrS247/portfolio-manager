<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\TaskComment;
use App\Models\ActivityLog;
use App\Models\Task;

class TaskCommentController extends Controller
{
    /**
     * Return true if $user is a project manager without admin rights who cannot
     * access the given task (task not created by them).
     */
    private function pmLacksTaskAccess($user, Task $task): bool
    {
        $isPM = $user && $user->role?->name === 'project_manager' && !$user->role?->is_admin;
        return $isPM && (int)$task->created_by !== (int)$user->id;
    }

    // GET /api/tasks/{id}/comments
    public function index(Request $request, int $taskId)
    {
        $task = Task::findOrFail($taskId);
        $user = $request->attributes->get('auth_user');

        if ($this->pmLacksTaskAccess($user, $task)) {
            return response()->json(['error' => 'Not authorised'], 403);
        }

        $comments = TaskComment::with('user:id,username')
            ->where('task_id', $taskId)
            ->orderBy('created_at', 'asc')
            ->get();

        return response()->json($comments);
    }

    // POST /api/tasks/{id}/comments
    public function store(Request $request, int $taskId)
    {
        $request->validate(['content' => 'required|string|max:5000']);
        $user = $request->attributes->get('auth_user');

        $task = Task::findOrFail($taskId);

        if ($this->pmLacksTaskAccess($user, $task)) {
            return response()->json(['error' => 'Not authorised'], 403);
        }

        $comment = TaskComment::create([
            'task_id' => $taskId,
            'user_id' => $user->id,
            'content' => trim($request->input('content')),
        ]);

        // Activity log
        ActivityLog::record('task', $taskId, 'comment_added',
            "{$user->username} added a comment",
            $user->id
        );

        return response()->json($comment->load('user:id,username'), 201);
    }

    // DELETE /api/tasks/{id}/comments/{commentId}
    public function destroy(Request $request, int $taskId, int $commentId)
    {
        $user    = $request->attributes->get('auth_user');
        $comment = TaskComment::where('task_id', $taskId)->findOrFail($commentId);

        // Only the author or an admin can delete
        if ($comment->user_id !== $user->id && !($user->role?->is_admin)) {
            return response()->json(['error' => 'Not authorised'], 403);
        }

        $comment->delete();

        ActivityLog::record('task', $taskId, 'comment_deleted',
            "{$user->username} deleted a comment",
            $user->id
        );

        return response()->json(['ok' => true]);
    }

    // GET /api/tasks/{id}/activity
    public function activity(Request $request, int $taskId)
    {
        $logs = \App\Models\ActivityLog::with('user:id,username')
            ->where('loggable_type', 'task')
            ->where('loggable_id', $taskId)
            ->orderBy('created_at', 'desc')
            ->limit(50)
            ->get();

        return response()->json($logs);
    }
}
