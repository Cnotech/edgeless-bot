@echo off

::移动
move /y ".\release\Atom x64" ".\build\Atom_bot"
echo LINK X:\Users\Default\Desktop\Atom,X:\Program Files\Edgeless\Atom_bot\Atom.exe >>./build/Atom_bot.wcs
