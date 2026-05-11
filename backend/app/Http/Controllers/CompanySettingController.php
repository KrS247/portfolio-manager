<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use App\Models\CompanySetting;

class CompanySettingController extends Controller
{
    /** MIME types allowed for company logos */
    private const ALLOWED_MIMES = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/gif'  => 'gif',
        'image/webp' => 'webp',
    ];

    public function show()
    {
        $setting = CompanySetting::find(1);
        return response()->json([
            'company_name' => $setting?->company_name,
            // Return a boolean flag instead of an APP_URL-dependent absolute URL.
            // The frontend constructs the logo URL itself as {apiBase}/logo so it
            // works in any environment without touching APP_URL.
            'has_logo'     => (bool) ($setting?->logo_path
                                && Storage::disk('public')->exists($setting->logo_path)),
        ]);
    }

    /**
     * Public (no auth) endpoint: streams the company logo binary.
     * Bypasses APP_URL entirely — the URL is always relative to the API host.
     */
    public function logo()
    {
        $setting = CompanySetting::find(1);

        if (!$setting?->logo_path || !Storage::disk('public')->exists($setting->logo_path)) {
            abort(404);
        }

        $contents = Storage::disk('public')->get($setting->logo_path);

        // Derive MIME from the stored extension (extension was set from the real
        // finfo MIME type at upload time, so it's trustworthy).
        $ext = strtolower(pathinfo($setting->logo_path, PATHINFO_EXTENSION));
        $extToMime = [
            'jpg'  => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'png'  => 'image/png',
            'gif'  => 'image/gif',
            'webp' => 'image/webp',
        ];
        $mime = $extToMime[$ext] ?? 'application/octet-stream';

        return response($contents, 200)
            ->header('Content-Type', $mime)
            ->header('Cache-Control', 'public, max-age=3600')
            ->header('X-Content-Type-Options', 'nosniff');
    }

    public function update(Request $request)
    {
        $request->validate([
            'company_name' => 'nullable|string|max:255',
            // Fix for audit finding M-9: use both mimes (finfo content check) and
            // an explicit getMimeType() verification below. max 2 MB.
            'logo'         => 'nullable|file|mimes:jpeg,gif,png,webp|max:2048',
        ]);

        $setting = CompanySetting::firstOrCreate(['id' => 1]);

        if ($request->hasFile('logo')) {
            $file     = $request->file('logo');
            $mimeType = $file->getMimeType(); // reads actual file content via finfo

            if (!array_key_exists($mimeType, self::ALLOWED_MIMES)) {
                Log::warning('CompanySettingController: rejected upload with disallowed MIME', [
                    'mime'     => $mimeType,
                    'filename' => $file->getClientOriginalName(),
                ]);
                return response()->json(['error' => 'Invalid file type. Only JPEG, PNG, GIF and WebP images are allowed.'], 422);
            }

            // Delete old logo if exists
            if ($setting->logo_path) {
                Storage::disk('public')->delete($setting->logo_path);
            }

            // Store with a known-safe extension derived from the real MIME type,
            // not from the client-supplied filename (prevents extension spoofing).
            $ext  = self::ALLOWED_MIMES[$mimeType];
            $name = 'logos/' . \Illuminate\Support\Str::random(40) . '.' . $ext;
            Storage::disk('public')->put($name, file_get_contents($file->getRealPath()));
            $setting->logo_path = $name;
        }

        $setting->company_name = $request->input('company_name');
        $setting->updated_at   = now();
        $setting->save();

        return response()->json([
            'company_name' => $setting->company_name,
            'has_logo'     => (bool) ($setting->logo_path
                                && Storage::disk('public')->exists($setting->logo_path)),
        ]);
    }
}
