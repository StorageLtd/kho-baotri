param([Parameter(Mandatory=$true)][string]$ReferenceDirectory,[Parameter(Mandatory=$true)][string]$OutputPath)
$ErrorActionPreference='Stop'
$parse=[Microsoft.CodeAnalysis.CSharp.CSharpParseOptions]::Default.WithLanguageVersion([Microsoft.CodeAnalysis.CSharp.LanguageVersion]::CSharp5)
$tree=[Microsoft.CodeAnalysis.CSharp.CSharpSyntaxTree]::ParseText([IO.File]::ReadAllText((Join-Path $PSScriptRoot 'Launcher.cs')),$parse)
$refs=[Microsoft.CodeAnalysis.MetadataReference[]]@('mscorlib.dll','System.dll','System.Windows.Forms.dll'|ForEach-Object {[Microsoft.CodeAnalysis.MetadataReference]::CreateFromFile((Join-Path $ReferenceDirectory $_))})
$options=[Microsoft.CodeAnalysis.CSharp.CSharpCompilationOptions]::new([Microsoft.CodeAnalysis.OutputKind]::WindowsApplication).WithPlatform([Microsoft.CodeAnalysis.Platform]::X64)
$compilation=[Microsoft.CodeAnalysis.CSharp.CSharpCompilation]::Create('LTD-CMMS',[Microsoft.CodeAnalysis.SyntaxTree[]]@($tree),$refs,$options)
$errors=@($compilation.GetDiagnostics()|Where-Object Severity -eq 'Error');if($errors.Count){throw ($errors|Out-String)}
$stream=[IO.File]::Open($OutputPath,[IO.FileMode]::Create,[IO.FileAccess]::ReadWrite)
try{$result=$compilation.Emit($stream);if(-not $result.Success){throw ($result.Diagnostics|Out-String)}}finally{$stream.Dispose()}
Write-Output 'PASS: native Windows x64 launcher built with .NET Framework 4.8 references.'
