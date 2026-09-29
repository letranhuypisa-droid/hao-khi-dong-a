#!/bin/bash
# Render VFX sprites + BGM for Hào Khí Đông A via Higgsfield CLI. Writes JSON results per job.
OUT="$1"; mkdir -p "$OUT"
STYLE="Vietnamese lacquer painting (sơn mài) style, gold leaf and vermilion red, hand-painted brush texture, isolated single element centered, no text, no background, transparent background"
img() { # name prompt
  higgsfield generate create gpt_image_2 --prompt "$2. $STYLE" --background transparent --quality high --resolution 1k --aspect_ratio 1:1 --wait --json > "$OUT/$1.json" 2> "$OUT/$1.err" &
}
mus() { # name duration prompt
  higgsfield generate create sonilo_music --prompt "$3" --duration "$2" --wait --wait-timeout 20m --json > "$OUT/$1.json" 2> "$OUT/$1.err" &
}
img fx-slash "A single sweeping crescent sword slash arc, bright white-gold core fading to transparent at both tips, dynamic calligraphic brush stroke, seen flat"
img fx-spark "A radiant hit impact flash: sharp eight-point gold and white starburst with small flying ember sparks, glowing"
img fx-smoke "A soft billowing puff of dust and smoke cloud, warm ochre-grey, wispy edges fading to transparent"
img fx-ring "A thin circular shockwave ring painted in one confident ink-brush stroke, gold with vermilion edge, empty transparent center, perfect circle seen from above"
img fx-redring "A circular warning ring painted as a single bold vermilion red brush stroke with a faint red glow, empty transparent center, seen from above"
img fx-fire "A tall stylized flame with curling tongues of fire, red-orange core and gold highlights, like a lacquer painting of fire"
img fx-embers "A cluster of rising glowing gold embers and small sparks scattered vertically, soft glow"
img fx-seal "A round bronze drum (trống đồng) face ornament with a sun star in the center and concentric ring patterns of flying birds, gold on transparent"
mus bgm-hub 120 "Traditional Vietnamese court music for a military camp at dusk: đàn tranh zither, sáo trúc bamboo flute, đàn bầu monochord, soft frame drum, calm, noble, contemplative, 13th century Trần dynasty atmosphere, seamless loop, instrumental only"
mus bgm-battle 150 "Epic Vietnamese war battle music, relentless trống trận war drums and bronze drum hits, kèn bầu shawm melody, đàn nguyệt plucked lute riffs, driving 140 BPM rhythm, heroic and urgent, ancient army charging on a river bank, seamless loop, instrumental only"
mus bgm-boss 120 "Climactic Vietnamese battle music for a duel with an enemy general: thunderous massed war drums, gongs, low horn blasts, fast đàn nguyệt tremolo, tense rising strings, 150 BPM, dramatic and heroic, seamless loop, instrumental only"
mus bgm-victory 30 "Short triumphant Vietnamese victory fanfare: three rolls of war drums, bright kèn shawm and bamboo flute melody, joyful celebration of a hard-won battle, ending cleanly, instrumental only"
wait
echo DONE
