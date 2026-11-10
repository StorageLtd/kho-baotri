param([Parameter(Mandatory=$true)][string]$ReferenceDirectory)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$module=Get-Content (Join-Path $root 'tools/fanuc-bridge-manager/Manager.Transfer.ps1') -Raw
$match=[regex]::Match($module,'-ReferencedAssemblies @\(([^)]+)\)')
if(-not $match.Success){throw 'Windows compilation references missing.'}
$names=@('mscorlib.dll')+@([regex]::Matches($match.Groups[1].Value,"'([^']+)'")|ForEach-Object {$_.Groups[1].Value})
$trees=@();$parse=[Microsoft.CodeAnalysis.CSharp.CSharpParseOptions]::Default.WithLanguageVersion([Microsoft.CodeAnalysis.CSharp.LanguageVersion]::CSharp5)
foreach($name in @('ProgramTransfer.cs','WebTransferServer.cs')){
 $source=[IO.File]::ReadAllText((Join-Path $root "tools/fanuc-bridge-manager/transfer/$name"))
 if($source -cne [IO.File]::ReadAllText((Join-Path $root "tools/fanuc-program-transfer/$name"))){throw "Canonical and Manager source differ: $name"}
 $trees+=[Microsoft.CodeAnalysis.CSharp.CSharpSyntaxTree]::ParseText($source,$parse)
}
$refs=[Microsoft.CodeAnalysis.MetadataReference[]]@($names|ForEach-Object {[Microsoft.CodeAnalysis.MetadataReference]::CreateFromFile((Join-Path $ReferenceDirectory $_))})
$options=[Microsoft.CodeAnalysis.CSharp.CSharpCompilationOptions]::new([Microsoft.CodeAnalysis.OutputKind]::DynamicallyLinkedLibrary)
$compilation=[Microsoft.CodeAnalysis.CSharp.CSharpCompilation]::Create('LTD.Transfer.NetFramework.Compatibility',[Microsoft.CodeAnalysis.SyntaxTree[]]$trees,$refs,$options)
$errors=@($compilation.GetDiagnostics()|Where-Object Severity -eq 'Error')
if($errors.Count){throw ($errors|Out-String)}
$stream=New-Object IO.MemoryStream
try{$result=$compilation.Emit($stream);if(-not $result.Success){throw ($result.Diagnostics|Out-String)}}finally{$stream.Dispose()}
Write-Host 'PASS: actual Manager transfer C# sources compile/emit with C# 5 and .NET Framework reference assemblies, using exactly the shipped Windows PowerShell reference list. No native calls or GUI execution.'
