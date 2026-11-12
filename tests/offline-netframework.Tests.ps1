param([Parameter(Mandatory=$true)][string]$ReferenceDirectory)
$ErrorActionPreference='Stop'
$root=Join-Path (Split-Path $PSScriptRoot -Parent) 'tools/ltd-cmms-offline'
$parse=[Microsoft.CodeAnalysis.CSharp.CSharpParseOptions]::Default.WithLanguageVersion([Microsoft.CodeAnalysis.CSharp.LanguageVersion]::CSharp5)
$trees=@('LocalHost.cs','FanucReader.cs')|ForEach-Object {[Microsoft.CodeAnalysis.CSharp.CSharpSyntaxTree]::ParseText([IO.File]::ReadAllText((Join-Path $root $_)),$parse)}
$refs=[Microsoft.CodeAnalysis.MetadataReference[]]@('mscorlib.dll','System.dll','System.Core.dll'|ForEach-Object {[Microsoft.CodeAnalysis.MetadataReference]::CreateFromFile((Join-Path $ReferenceDirectory $_))})
$options=[Microsoft.CodeAnalysis.CSharp.CSharpCompilationOptions]::new([Microsoft.CodeAnalysis.OutputKind]::DynamicallyLinkedLibrary)
$compilation=[Microsoft.CodeAnalysis.CSharp.CSharpCompilation]::Create('LTD.Offline.WindowsCompatibility',[Microsoft.CodeAnalysis.SyntaxTree[]]$trees,$refs,$options)
$errors=@($compilation.GetDiagnostics()|Where-Object Severity -eq 'Error');if($errors.Count){throw ($errors|Out-String)}
$stream=New-Object IO.MemoryStream
try{$result=$compilation.Emit($stream);if(-not $result.Success){throw ($result.Diagnostics|Out-String)}}finally{$stream.Dispose()}
Write-Output 'PASS: offline server/crypto and CNC reader compile against .NET Framework 4.8 / C# 5 references; no native CNC or GUI execution.'
