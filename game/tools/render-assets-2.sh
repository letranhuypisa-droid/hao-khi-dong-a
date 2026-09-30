#!/bin/bash
# Đợt 7: icon chiêu thức (GPT Image 2, medium, 1k) và SFX (Seed Audio 1.0) cho Hào Khí Đông A qua Higgsfield CLI.
#   bash tools/render-assets-2.sh <thư-mục-ra> [icons|sfx|all]
# Mỗi job ghi <tên>.json (kết quả) và <tên>.err. Hậu kỳ (cắt, thu nhỏ, đổi định dạng): tools/post-assets-2.py.
OUT="$1"; WHAT="${2:-all}"; mkdir -p "$OUT/icons" "$OUT/sfx"

ICON_STYLE="Game skill icon for a Vietnamese historical action game (Trần dynasty, 13th century). Square icon, full-bleed, one bold centered emblem readable at 64 pixels. Vietnamese lacquer painting (sơn mài) style: deep black-brown lacquer background with subtle crackle texture and a soft vermilion glow behind the emblem, emblem in hammered gold leaf with vermilion red accents and eggshell-white highlights, strong silhouette, high contrast, painterly brush edges. No text, no letters, no frame, no border."
# Tài khoản giới hạn 4 job chạy cùng lúc mỗi model: chờ bớt job rồi mới gửi. Job đã có kết quả thì bỏ qua (chạy lại
# kịch bản để bù những job lỗi 503 / rate limit).
throttle() { while [ "$(jobs -rp | wc -l)" -ge 4 ]; do wait -n; done; }
done_already() { grep -q '"result_url": *"http' "$1" 2>/dev/null; }
icon() { # tên prompt
  done_already "$OUT/icons/$1.json" && return; throttle
  higgsfield generate create gpt_image_2 --prompt "$2. $ICON_STYLE" --quality medium --resolution 1k --aspect_ratio 1:1 --wait --json > "$OUT/icons/$1.json" 2> "$OUT/icons/$1.err" &
}
SFX_PRE="Sound effect only, no music, no speech, no background noise:"
sfx() { # tên prompt  (mỗi tên sinh 1 bản; gọi nhiều lần với hậu tố -1, -2 để có biến thể)
  done_already "$OUT/sfx/$1.json" && return; throttle
  higgsfield generate create seed_audio --prompt "$2" --format wav --sample_rate 44100 --wait --json > "$OUT/sfx/$1.json" 2> "$OUT/sfx/$1.err" &
}

if [ "$WHAT" = "icons" ] || [ "$WHAT" = "all" ]; then
icon n        "Two crossed curved sabers (song đao) slashing, with a sweeping gold crescent slash trail"
icon c1       "A single curved saber thrusting forward and shattering a round wooden shield into flying splinters and shards"
icon c2       "An upward rising saber slash launching an enemy soldier's helmet and broken spear high into the air, upward swirl of wind"
icon c3       "A whirlwind vortex of spinning curved blades, a circular tornado of gold slash arcs"
icon c4       "Twin sabers striking down into the earth, a circular shockwave and cracks radiating across the ground"
icon c5       "A long straight streak of gold light piercing through a row of enemy spears, a warrior dashing forward"
icon c6       "A massive storm of gold slash crescents exploding outward in every direction from one center"
icon dash     "A low sweeping saber slash combined with a fast forward dash, horizontal speed streaks"
icon dq       "A single decisive vertical saber strike cleaving an enemy general's horned helmet, bright burst of light at the point of impact"
icon ct       "Two blades clashing with a bright starburst spark, one blade deflecting the other, a curved counter-strike arrow"
icon dodge    "A warrior rolling sideways leaving gold afterimages, evasive curved motion swirl"
icon block    "Twin sabers crossed defensively in an X blocking an incoming spear tip, sparks at the contact point"
icon skill    "A charging warrior bursting through a wall of enemy shields, three forward arrow-shaped streaks of force"
icon ult      "A clenched fist crushing an orange, juice and gold light bursting out between the fingers, fierce vermilion aura"
icon tpc      "A great Đông Sơn bronze drum being struck by a drumstick, shockwave of sound rings, red war banners surging behind"
icon cmd      "A triangular commander's war flag (cờ lệnh) planted in the ground, fluttering, with a command baton"
icon tiencong "A red army banner and three spear tips all pointing forward to the right, advancing charge"
icon giuvung  "A solid wall of planted rectangular shields with spears bristling, an unbreakable defensive line"
icon theota   "A general's tall banner in front with a column of soldiers' helmets following behind it in a line"
icon tiepvien "A buffalo-horn war trumpet (tù và) blowing, sound waves, columns of reinforcement spears arriving"
icon kesach   "An unrolled bamboo strategy scroll with a battle map, a brush and a small command flag on it"
icon lock     "Four gold arrowheads converging on an enemy horned helmet, target lock"
fi

if [ "$WHAT" = "sfx" ] || [ "$WHAT" = "all" ]; then
for v in 1 2 3; do
  sfx swing-$v   "$SFX_PRE a single fast steel saber swing whooshing through the air, sharp swish, very short"
  sfx slice-$v   "$SFX_PRE a sharp blade slicing into a soldier's body through cloth armor, wet meaty cut with a crisp impact transient, very short"
  sfx clang-$v   "$SFX_PRE a steel sword striking a wooden shield rimmed with iron, hard clank, very short"
done
for v in 1 2; do
  sfx swingheavy-$v "$SFX_PRE a heavy two-handed blade swung with full force, deep powerful whoosh, short"
  sfx hitheavy-$v   "$SFX_PRE a brutal heavy weapon blow landing on an armored warrior, bone-crunching thud with metal crash and a deep boom, very short"
  sfx fall-$v       "$SFX_PRE a soldier in leather and metal armor collapsing onto dirt ground, body thud and armor rattle, short"
  sfx grunt-$v      "Short male soldier pain grunt when struck, single vocal burst, no words, no music, dry"
  sfx kiai-$v       "Short fierce male warrior battle shout while striking, single sharp 'hah!' yell, no words, no music, dry"
  sfx bow-$v        "$SFX_PRE a wooden bow string released, twang followed by an arrow whistling away, short"
done
sfx parry      "$SFX_PRE two steel swords colliding in a perfect parry, bright ringing metallic clash that sings and rings out"
sfx finisher   "$SFX_PRE a devastating final sword strike: huge slash impact with a deep cinematic boom and a ringing metal tail"
sfx slam       "$SFX_PRE a heavy blade slammed into the ground, earth cracking boom, rocks and dirt debris scattering"
sfx dash       "$SFX_PRE a warrior rushing forward at great speed, strong wind rush and cloth flapping, short"
sfx roll       "$SFX_PRE a quick evasive roll on dirt ground, cloth rustle and foot scuff, very short"
sfx hurt       "Short male warrior pain groan when wounded, single vocal burst, no words, no music, dry"
sfx arrowhit   "$SFX_PRE an arrow thudding into a wooden shield, sharp thunk, very short"
sfx volley     "$SFX_PRE a volley of many arrows whistling through the air overhead"
sfx crossbow   "$SFX_PRE a crossbow firing, mechanical trigger clack and bolt release thwack, very short"
sfx horn       "$SFX_PRE a long deep buffalo-horn war trumpet blast echoing over a battlefield"
sfx drum       "$SFX_PRE a single deep hit on a large ancient war drum, booming low resonance"
sfx drumroll   "$SFX_PRE three rolls of large ancient war drums building up, powerful and heroic"
sfx gong       "$SFX_PRE a large bronze gong struck once, shimmering long resonance"
sfx gatehit    "$SFX_PRE a heavy wooden fortress gate being struck hard, deep wooden thud and creak"
sfx gatebreak  "$SFX_PRE a massive wooden fortress gate smashing apart, splintering crash and debris falling"
sfx cheer      "$SFX_PRE a large army of soldiers cheering and roaring in victory"
sfx roar       "Enemy warlord's deep menacing battle roar, single long vocal roar, no words, no music"
sfx charge     "$SFX_PRE a heavily armored brute charging, heavy running footsteps and armor clanking, then a body slam impact"
sfx pickup     "$SFX_PRE a short bright wooden chime and soft bell, pleasant item pickup"
sfx ui         "$SFX_PRE a single soft wooden block tick, very short user interface click"
sfx warn       "$SFX_PRE a sharp high-pitched metallic danger ring, like a blade being drawn quickly, very short"
sfx ultstart   "$SFX_PRE a rising surge of power: deep drum boom, whoosh of wind and a blade ring, epic, short"
sfx ambience   "$SFX_PRE distant ancient battlefield ambience: hundreds of soldiers fighting far away, swords clashing, muffled shouting, occasional war drums, continuous, no music"
sfx fire       "$SFX_PRE a large wooden camp burning, continuous fire crackling and roaring flames"
fi

# Đợt bù (sau khi soi phổ đợt đầu): hitheavy-1/2, fall-1/2 ra tiếng ù kéo dài, warn lên chậm 1,4 s, bow-1 có hai tiếng
# rời nhau. Prompt nói rõ "một tiếng rồi im" và độ dài.
if [ "$WHAT" = "sfx2" ] || [ "$WHAT" = "all" ]; then
for v in 3 4 5; do
  sfx hitheavy-$v "$SFX_PRE one single punchy heavy impact of a war hammer blow on an armored soldier: a sharp crack and deep thud, then complete silence, under half a second long"
done
for v in 3 4; do
  sfx fall-$v "$SFX_PRE one single armored body dropping onto hard dirt: one heavy thud with a brief metal rattle, then complete silence, under one second long"
done
sfx warn-2 "$SFX_PRE a single instant bright metallic shing of a sword being drawn from its scabbard, sharp attack from the very first moment, under half a second long"
sfx bow-3  "$SFX_PRE one single bow shot: a sharp string twang and a short arrow whoosh, then silence, under one second long"
fi
wait
echo DONE
