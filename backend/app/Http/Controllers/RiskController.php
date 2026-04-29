<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Risk;

class RiskController extends Controller {
    private function getRiskStatus($rate) {
        if ($rate <= 5) return 'Low Risk';
        if ($rate <= 10) return 'Medium Risk';
        if ($rate <= 15) return 'High Risk';
        return 'Critical Risk';
    }

    public function index(Request $request) {
        $query = Risk::with(['task']);
        if ($request->task_id) $query->where('task_id', $request->task_id);

        $risks = $query->get()->map(function ($risk) {
            $task = $risk->task;
            $row  = $risk->toArray();

            $row['task_title']      = $task?->title;
            $row['task_status']     = $task?->status;
            $row['task_created_by'] = $task?->created_by;

            $projectId = $programId = $portfolioId = null;
            $projectName = $programName = $portfolioName = null;

            if ($task?->parent_type === 'project') {
                $project = \App\Models\Project::with(['program.portfolio'])->find($task->parent_id);
                if ($project) {
                    $projectId    = $project->id;
                    $projectName  = $project->name;
                    $programId    = $project->program?->id;
                    $programName  = $project->program?->name;
                    $portfolioId  = $project->program?->portfolio?->id;
                    $portfolioName = $project->program?->portfolio?->name;
                }
            } elseif ($task?->parent_type === 'program') {
                $program = \App\Models\Program::with(['portfolio'])->find($task->parent_id);
                if ($program) {
                    $programId    = $program->id;
                    $programName  = $program->name;
                    $portfolioId  = $program->portfolio?->id;
                    $portfolioName = $program->portfolio?->name;
                }
            } elseif ($task?->parent_type === 'portfolio') {
                $portfolio = \App\Models\Portfolio::find($task->parent_id);
                if ($portfolio) {
                    $portfolioId  = $portfolio->id;
                    $portfolioName = $portfolio->name;
                }
            }

            $row['project_id']     = $projectId;
            $row['project_name']   = $projectName;
            $row['program_id']     = $programId;
            $row['program_name']   = $programName;
            $row['portfolio_id']   = $portfolioId;
            $row['portfolio_name'] = $portfolioName;

            return $row;
        });

        return response()->json($risks);
    }

    public function store(Request $request) {
        $data = $request->validate([
            'task_id' => 'required|integer',
            'name' => 'nullable|string',
            'description' => 'nullable|string',
            'probability' => 'required|integer|between:1,5',
            'impact' => 'required|integer|between:1,5',
            'mitigation_plan' => 'nullable|string',
            'status' => 'nullable|in:open,active,mitigated,closed',
        ]);

        $data['risk_rate'] = $data['probability'] * $data['impact'];
        $data['risk_status'] = $this->getRiskStatus($data['risk_rate']);

        $risk = Risk::create($data);
        return response()->json($risk, 201);
    }

    public function update(Request $request, $id) {
        $risk = Risk::findOrFail($id);
        $updateData = $request->only(['name', 'description', 'probability', 'impact', 'mitigation_plan', 'status']);

        if (isset($updateData['probability']) && isset($updateData['impact'])) {
            $updateData['risk_rate'] = $updateData['probability'] * $updateData['impact'];
            $updateData['risk_status'] = $this->getRiskStatus($updateData['risk_rate']);
        } elseif (isset($updateData['probability'])) {
            $updateData['risk_rate'] = $updateData['probability'] * $risk->impact;
            $updateData['risk_status'] = $this->getRiskStatus($updateData['risk_rate']);
        } elseif (isset($updateData['impact'])) {
            $updateData['risk_rate'] = $risk->probability * $updateData['impact'];
            $updateData['risk_status'] = $this->getRiskStatus($updateData['risk_rate']);
        }

        $risk->update($updateData);
        return response()->json($risk);
    }
}
