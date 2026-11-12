function Show-DesktopCnc([string]$Id){
 if($script:DesktopDetails.ContainsKey($Id)){$script:DesktopDetails[$Id].window.Activate();return}
 $machine=$script:Database.cncs[$Id];if(-not $machine){return}
 $window=New-DesktopWindow ('CNC · '+$machine.name) 1180 800
 $dock=New-Object Windows.Controls.DockPanel;$dock.Margin='20';$window.Content=$dock
 $heading=New-Object Windows.Controls.TextBlock;$heading.FontSize=21;$heading.FontWeight='Bold';$heading.Margin='0,0,0,8';[Windows.Controls.DockPanel]::SetDock($heading,'Top');$dock.Children.Add($heading)|Out-Null
 $metrics=New-Object Windows.Controls.TextBlock;$metrics.FontSize=14;$metrics.TextWrapping='Wrap';$metrics.Margin='0,0,0,14';[Windows.Controls.DockPanel]::SetDock($metrics,'Top');$dock.Children.Add($metrics)|Out-Null
 $bottom=New-Object Windows.Controls.StackPanel;$bottom.Orientation='Horizontal';$bottom.HorizontalAlignment='Right';$bottom.Margin='0,12,0,0';[Windows.Controls.DockPanel]::SetDock($bottom,'Bottom');$dock.Children.Add($bottom)|Out-Null
 foreach($action in @(@('Alarm của máy','alarms'),@('Báo cáo vận hành','reports'))){$b=New-Object Windows.Controls.Button;$b.Content=$action[0];$b.Tag=@{id=$Id;action=$action[1]};$b.Add_Click({param($sender,$eventArgs);$machine=$script:Database.cncs[$sender.Tag.id];Show-DesktopTable ($machine.name+' · '+$sender.Content) (Get-DesktopDefinitions $sender.Tag.action) (Get-DesktopRows $sender.Tag.action '' $sender.Tag.id)});$bottom.Children.Add($b)|Out-Null}
 $tabs=New-Object Windows.Controls.TabControl;$dock.Children.Add($tabs)|Out-Null
 $controls=@{}
 foreach($tabName in @('POSITION','PROGRAM','WORK','OFFSET','LOAD','ALARM','CHẨN ĐOÁN')){
  $tab=New-Object Windows.Controls.TabItem;$tab.Header=$tabName;$tab.Padding='16,9';$tabs.Items.Add($tab)|Out-Null
  if($tabName -in @('PROGRAM','CHẨN ĐOÁN')){$control=New-Object Windows.Controls.TextBox;$control.IsReadOnly=$true;$control.AcceptsReturn=$true;$control.FontFamily='Consolas';$control.FontSize=14;$control.VerticalScrollBarVisibility='Auto';$control.HorizontalScrollBarVisibility='Auto';$control.Margin='10'}
  else{$control=New-Object Windows.Controls.DataGrid;$control.Margin='10'}
  $tab.Content=$control;$controls[$tabName]=$control
 }
 Set-DesktopColumns $controls.POSITION @(@('Trục','Axis',14),@('Absolute','Absolute',24),@('Relative','Relative',24),@('Machine','Machine',24),@('Distance to go','Distance',24),@('Đơn vị','Unit',16))
 Set-DesktopColumns $controls.WORK @(@('Gốc','Name',20),@('X','X',22),@('Y','Y',22),@('Z','Z',22),@('Đơn vị','Unit',16))
 Set-DesktopColumns $controls.OFFSET @(@('Số ô','Number',14),@('H Geometry','LengthGeometry',24),@('H Wear','LengthWear',22),@('D Geometry','RadiusGeometry',24),@('D Wear','RadiusWear',22))
 Set-DesktopColumns $controls.LOAD @(@('Thông số','Name',45),@('Giá trị','Value',25),@('Đơn vị','Unit',20))
 Set-DesktopColumns $controls.ALARM @(@('Mã alarm','Number',20),@('Loại','Type',14),@('Trục','Axis',14),@('Nội dung','Message',85))
 $window.Tag=$Id;$window.Add_Closed({param($sender,$eventArgs);$script:DesktopDetails.Remove([string]$sender.Tag)})
 $script:DesktopDetails[$Id]=@{window=$window;heading=$heading;metrics=$metrics;controls=$controls}
 Update-DesktopCncDetails $Id;$window.Show()
}
function Format-DesktopCoordinate($Value){if($null -eq $Value.value){return '-'};if($Value.decimals -ge 0 -and $Value.decimals -le 9){return ([double]$Value.value).ToString('F'+$Value.decimals,[Globalization.CultureInfo]::InvariantCulture)};return [string]$Value.value}
function Update-DesktopCncDetails([string]$Id){
 $detail=$script:DesktopDetails[$Id];$m=$script:Database.cncs[$Id];if(-not $detail -or -not $m){return}
 $state=Get-DesktopCncState $m;$detail.heading.Text=$m.name+'   ·   '+$state.name;$detail.heading.Foreground=$state.color
 $live=$state.live;$ctx=if($live){$m.machiningContext}else{$null}
 $tool=if($ctx.spindleToolConfirmed -eq $true -and $null -ne $ctx.spindleToolNumber){'T'+$ctx.spindleToolNumber}else{'-'};$next=if($null -ne $ctx.nextToolNumber){'T'+$ctx.nextToolNumber}else{'-'}
 $detail.metrics.Text=if($live){'Chương trình: '+$m.activeProgram+'     PART COUNT: '+$m.partCounter+'     RUN: '+(Get-DesktopDuration $m.runTimeMs)+'     CYCLE: '+(Get-DesktopDuration $m.cycleTimeMs)+"`nSpindle: "+$m.spindleSpeed+' RPM     Feed: '+$m.feedrate+' '+$m.feedrateUnit+'     Tải trục chính: '+$m.spindleLoad+' %'+"`nDao trục chính: "+$tool+'     Dao chờ: '+$next+'     WORK: '+$ctx.workCoordinate}else{'Chưa có tín hiệu mới. Các giá trị vận hành tạm thời không khả dụng.'}
 $positions=@();if($live){foreach($p in $m.positions){$positions+=[pscustomobject]@{Axis=$p.axis;Absolute=(Format-DesktopCoordinate $p.absolute);Relative=(Format-DesktopCoordinate $p.relative);Machine=(Format-DesktopCoordinate $p.machine);Distance=(Format-DesktopCoordinate $p.distance);Unit=$p.absolute.unit}}}
 $detail.controls.POSITION.ItemsSource=[object[]]$positions
 $loads=@();if($live){foreach($load in $m.servoLoads){$loads+=[pscustomobject]@{Name=('Servo '+$load.axis);Value=$load.percent;Unit='%'}};$loads+=[pscustomobject]@{Name='Tải trục chính';Value=$m.spindleLoad;Unit='%'};$loads+=[pscustomobject]@{Name='Tốc độ trục chính';Value=$m.spindleSpeed;Unit='RPM'}};$detail.controls.LOAD.ItemsSource=[object[]]$loads
 $work=@();if($live){foreach($r in $m.workCoordinates){$work+=[pscustomobject]@{Name=$r.name;X=$r.x;Y=$r.y;Z=$r.z;Unit=$r.unit}}};$detail.controls.WORK.ItemsSource=[object[]]$work
 $offsets=@();if($live){foreach($r in $m.toolOffsets.rows){$offsets+=[pscustomobject]@{Number=$r.number;LengthGeometry=$r.lengthGeometry;LengthWear=$r.lengthWear;RadiusGeometry=$r.radiusGeometry;RadiusWear=$r.radiusWear}}};$detail.controls.OFFSET.ItemsSource=[object[]]$offsets
 $alarms=@();if($live){foreach($r in $m.alarmDetails){$alarms+=[pscustomobject]@{Number=$r.number;Type=$r.type;Axis=$r.axis;Message=$r.message}}};$detail.controls.ALARM.ItemsSource=[object[]]$alarms
 $full=$live -and $m.fullProgram.complete -eq $true -and $m.fullProgram.program -eq $m.activeProgram
 if($full){try{$verified=[DateTimeOffset]::Parse([string]$m.fullProgramVerifiedAt).ToUnixTimeMilliseconds();$age=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()-$verified;$full=$age -ge -5000 -and $age -le 120000 -and ([string]$m.fullProgram.text).Length -le 2097152}catch{$full=$false}}
 $program=if(-not $live){'Chưa có tín hiệu mới.'}elseif($full){$m.fullProgram.text}elseif($m.programText){'[Đoạn chương trình CNC trả về]'+"`r`n"+$m.programText}else{'Chưa đọc được nội dung chương trình.'}
 if($live -and $m.modalGcodes){$program='MODAL: '+(($m.modalGcodes|ForEach-Object {$_.code}) -join ' ')+"`r`n`r`n"+$program}
 if($detail.controls.PROGRAM.Text -cne $program){$detail.controls.PROGRAM.Text=$program}
 $errors=@();foreach($key in $m.readErrors.Keys){$errors+=($key+': '+$m.readErrors[$key])};$detail.controls['CHẨN ĐOÁN'].Text=($errors -join "`r`n")
}
function Render-DesktopCncTiles {
 $panel=$script:DesktopUi.CncTiles;$panel.Children.Clear();$term=$script:DesktopUi.Search.Text
 foreach($id in $script:Database.cncs.Keys){
  $m=$script:Database.cncs[$id];if($term -and ($m.name+' '+$m.ip).IndexOf($term,[StringComparison]::OrdinalIgnoreCase) -lt 0){continue}
  $state=Get-DesktopCncState $m
  $border=New-Object Windows.Controls.Border;$border.Width=345;$border.Height=215;$border.Margin='0,0,14,14';$border.Background='White';$border.BorderBrush=$state.color;$border.BorderThickness='1,5,1,1';$border.CornerRadius='8'
  $stack=New-Object Windows.Controls.StackPanel;$stack.Margin='18,12';$border.Child=$stack
  $name=New-Object Windows.Controls.TextBlock;$name.Text=$m.name;$name.FontSize=18;$name.FontWeight='SemiBold';$stack.Children.Add($name)|Out-Null
  $status=New-Object Windows.Controls.TextBlock;$status.Text='● '+$state.name;$status.Foreground=$state.color;$status.Margin='0,8,0,8';$status.FontWeight='Bold';$stack.Children.Add($status)|Out-Null
  $info=New-Object Windows.Controls.TextBlock;$info.TextWrapping='Wrap';$info.Text=$m.ip+':'+$m.port+"`n"+$(if($state.live){'Chương trình: '+$m.activeProgram+'   ·   Part: '+$m.partCounter+"`nRUN "+(Get-DesktopDuration $m.runTimeMs)}else{'Đang chờ dữ liệu CNC'});$info.Foreground='#60778D';$info.Margin='0,0,0,12';$stack.Children.Add($info)|Out-Null
  $row=New-Object Windows.Controls.StackPanel;$row.Orientation='Horizontal';$stack.Children.Add($row)|Out-Null
  foreach($entry in @(@('Xem máy','view'),@('Alarm','alarm'),@('⚙','edit'),@('✕','delete'))){$button=New-Object Windows.Controls.Button;$button.Content=$entry[0];$button.Tag=@{id=$id;action=$entry[1]};$button.Padding='11,6';if($entry[1] -in @('edit','delete')){$button.IsEnabled=Test-DesktopEdit};$button.Add_Click({param($sender,$eventArgs);switch($sender.Tag.action){'view'{Show-DesktopCnc $sender.Tag.id}'edit'{Show-DesktopEditor 'cnc' $sender.Tag.id}'delete'{if([Windows.MessageBox]::Show($script:DesktopWindow,'Xóa máy khỏi danh sách giám sát?','LTD','YesNo') -eq 'Yes'){$null=Invoke-DesktopApi ('/api/database/cncs/'+$sender.Tag.id+'.json') 'DELETE';Refresh-DesktopView}}'alarm'{$m=$script:Database.cncs[$sender.Tag.id];Show-DesktopTable ('Alarm · '+$m.name) (Get-DesktopDefinitions 'alarms') (Get-DesktopRows 'alarms' '' $sender.Tag.id)}}});$row.Children.Add($button)|Out-Null}
  $panel.Children.Add($border)|Out-Null
 }
}
