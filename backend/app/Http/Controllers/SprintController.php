<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use App\Models\Sprint;

class SprintController extends Controller {

    public function index() {
        return response()->json(Sprint::orderBy('start_date')->orderBy('id')->get());
    }

    public function store(Request $request) {
        $data = $request->validate([
            'name'           => 'required|string|max:200',
            'start_date'     => ['required', 'date', function ($attr, $value, $fail) {
                // ISO day: 1=Monday … 7=Sunday
                if (date('N', strtotime($value)) !== '1') {
                    $fail('The sprint start date must be a Monday.');
                }
            }],
            'duration_weeks' => 'required|integer|min:2|max:6',
            'status'         => 'nullable|in:planned,active,completed',
        ]);

        $sprint = Sprint::create($data);

        $actor = $request->attributes->get('auth_user');
        Log::info('Sprint created', ['sprint_id' => $sprint->id, 'name' => $sprint->name, 'actor' => $actor?->username]);

        return response()->json($sprint, 201);
    }

    public function update(Request $request, $id) {
        $sprint = Sprint::findOrFail($id);

        $request->validate([
            'name'           => 'sometimes|required|string|max:200',
            'start_date'     => ['sometimes', 'required', 'date', function ($attr, $value, $fail) {
                if (date('N', strtotime($value)) !== '1') {
                    $fail('The sprint start date must be a Monday.');
                }
            }],
            'duration_weeks' => 'sometimes|required|integer|min:2|max:6',
            'status'         => 'sometimes|nullable|in:planned,active,completed',
        ]);

        $before = $sprint->only(['name', 'start_date', 'duration_weeks', 'status']);
        $sprint->update($request->only(['name', 'start_date', 'duration_weeks', 'status']));

        $actor = $request->attributes->get('auth_user');
        Log::info('Sprint updated', ['sprint_id' => $id, 'before' => $before, 'after' => $sprint->only(['name', 'start_date', 'duration_weeks', 'status']), 'actor' => $actor?->username]);

        return response()->json($sprint);
    }

    public function destroy(Request $request, $id) {
        $sprint = Sprint::findOrFail($id);
        $name   = $sprint->name;
        $sprint->delete();

        $actor = $request->attributes->get('auth_user');
        Log::info('Sprint deleted', ['sprint_id' => $id, 'name' => $name, 'actor' => $actor?->username]);

        return response()->json(['message' => 'Sprint deleted']);
    }
}
