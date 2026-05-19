<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use App\Models\AgilePhase;

class AgilePhaseController extends Controller {

    public function index() {
        return response()->json(AgilePhase::orderBy('sequence')->orderBy('id')->get());
    }

    public function store(Request $request) {
        $data = $request->validate([
            'name'        => 'required|string|max:100',
            'description' => 'nullable|string|max:500',
        ]);

        // Place new phase at the end
        $data['sequence'] = (AgilePhase::max('sequence') ?? 0) + 1;

        $phase = AgilePhase::create($data);

        $actor = $request->attributes->get('auth_user');
        Log::info('Agile phase created', ['phase_id' => $phase->id, 'name' => $phase->name, 'actor' => $actor?->username]);

        return response()->json($phase, 201);
    }

    public function update(Request $request, $id) {
        $phase = AgilePhase::findOrFail($id);

        $request->validate([
            'name'        => 'sometimes|required|string|max:100',
            'description' => 'sometimes|nullable|string|max:500',
        ]);

        $before = $phase->only(['name', 'description']);
        $phase->update($request->only(['name', 'description']));

        $actor = $request->attributes->get('auth_user');
        Log::info('Agile phase updated', ['phase_id' => $id, 'before' => $before, 'after' => $phase->only(['name', 'description']), 'actor' => $actor?->username]);

        return response()->json($phase);
    }

    public function destroy(Request $request, $id) {
        $phase = AgilePhase::findOrFail($id);
        $name  = $phase->name;
        $phase->delete();

        // Re-sequence remaining phases
        AgilePhase::orderBy('sequence')->orderBy('id')->get()
            ->each(function ($p, $i) { $p->update(['sequence' => $i + 1]); });

        $actor = $request->attributes->get('auth_user');
        Log::info('Agile phase deleted', ['phase_id' => $id, 'name' => $name, 'actor' => $actor?->username]);

        return response()->json(['message' => 'Phase deleted']);
    }

    public function reorder(Request $request) {
        $request->validate(['ids' => 'required|array', 'ids.*' => 'integer']);

        foreach ($request->ids as $i => $id) {
            AgilePhase::where('id', $id)->update(['sequence' => $i + 1]);
        }

        $actor = $request->attributes->get('auth_user');
        Log::info('Agile phases reordered', ['ids' => $request->ids, 'actor' => $actor?->username]);

        return response()->json(AgilePhase::orderBy('sequence')->orderBy('id')->get());
    }
}
