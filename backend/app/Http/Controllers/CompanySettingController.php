<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use App\Models\CompanySetting;

class CompanySettingController extends Controller
{
    public function show()
    {
        $setting = CompanySetting::find(1);
        return response()->json([
            'company_name' => $setting?->company_name,
            'logo_url'     => $setting?->logo_path ? url('storage/' . $setting->logo_path) : null,
        ]);
    }

    public function update(Request $request)
    {
        $request->validate([
            'company_name' => 'nullable|string|max:255',
            'logo'         => 'nullable|file|mimes:jpeg,gif,png|max:1024',
        ]);

        $setting = CompanySetting::firstOrCreate(['id' => 1]);

        if ($request->hasFile('logo')) {
            // Delete old logo if exists
            if ($setting->logo_path) {
                Storage::disk('public')->delete($setting->logo_path);
            }
            $path = $request->file('logo')->store('logos', 'public');
            $setting->logo_path = $path;
        }

        $setting->company_name = $request->input('company_name');
        $setting->updated_at   = now();
        $setting->save();

        return response()->json([
            'company_name' => $setting->company_name,
            'logo_url'     => $setting->logo_path ? url('storage/' . $setting->logo_path) : null,
        ]);
    }
}
