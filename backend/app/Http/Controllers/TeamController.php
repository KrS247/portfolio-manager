<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Team;

class TeamController extends Controller {
    public function index() {
        return response()->json(Team::orderBy('name')->get());
    }

    public function store(Request $request) {
        $data = $request->validate(['name' => 'required|string|unique:teams,name']);
        $team = Team::create(['name' => $data['name']]);
        return response()->json($team, 201);
    }

    public function update(Request $request, $id) {
        $team = Team::findOrFail($id);
        $data = $request->validate(['name' => 'required|string|unique:teams,name,' . $id]);
        $team->update($data);
        return response()->json($team);
    }

    public function destroy($id) {
        Team::findOrFail($id)->delete();
        return response()->json(['message' => 'Team deleted']);
    }
}
