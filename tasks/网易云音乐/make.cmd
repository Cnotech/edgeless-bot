@echo off

::ɾ������
del /f /s /q .\release\$PLUGINSDIR
rd /s /q .\release\$PLUGINSDIR

::�ƶ�
move /y .\release .\build\NetEaseCloud_bot

::��������������
echo LINK X:\Users\Default\Desktop\����������,X:\Program Files\Edgeless\NetEaseCloud_bot\cloudmusic.exe >./build/NetEaseCloud_bot.wcs