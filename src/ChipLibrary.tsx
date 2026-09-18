import { AbsoluteFill, useCurrentFrame } from "remotion";
import { Backdrop } from "./scenes/Backdrop";
import { Chip, ChipCard, ChipFlow, Emoji } from "./scenes/chips";
import { ActionButton, Eye, Heart, PrimaryButton, Send, Upload } from "./scenes/ui";
import { at, css, enter } from "./scenes/motion";
import { palette, type as typo } from "./scenes/tokens";

// Витрина: что вообще есть в наборе и как оно ведёт себя в движении.
//
// Это не ролик, а справочник. Открывается в студии как Chips-Library, чтобы
// не вспоминать названия и не изобретать новую плашку там, где уже есть
// готовая. Правила отбора — в MONTAGE_RULES.md, разбор референсов —
// в references/.

const TOOLS = [
  [{ label: "подписка", emoji: "money_bag", origin: "что оплачиваем" }],
  [
    { label: "вариант А", emoji: "brain", origin: "дороже" },
    { label: "вариант Б", emoji: "rocket", origin: "лучше это", originTone: "good" as const },
  ],
  [
    { label: "сборка", emoji: "gear", origin: "для монтажа" },
    { label: "озвучка", emoji: "microphone", origin: "для голоса" },
    { label: "проверка", emoji: "magnifying_glass_tilted_left", origin: "для правок" },
  ],
];

const SHOWCASE = ["alarm_clock", "calendar", "chart_increasing", "fire", "light_bulb", "eyes", "red_heart", "party_popper"];

export const ChipLibrary = ({ light = false }: { light?: boolean }) => {
  const frame = useCurrentFrame();
  const c = palette(light);
  const title = enter(frame, 0, 18);

  return (
    <AbsoluteFill style={{ fontFamily: "Inter", color: c.text }}>
      <Backdrop light={light} />

      <div style={{ position: "absolute", left: 0, top: 96, width: 1080, textAlign: "center", ...css(title) }}>
        <div style={{ ...typo.headline, color: c.text }}>база плашек</div>
        <div style={{ ...typo.caption, color: c.textMuted, marginTop: 12 }}>
          значок — действие, эмодзи — предмет, подпись — происхождение
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          top: 268,
          width: 1080,
          display: "flex",
          justifyContent: "center",
          gap: 24,
          opacity: at(frame, 20, 34),
        }}
      >
        <Chip emoji="alarm_clock" light={light}>
          обычная
        </Chip>
        <Chip emoji="fire" tone="accent" light={light}>
          акцент
        </Chip>
        <Chip tone="filled" light={light}>
          залитая
        </Chip>
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          top: 380,
          width: 1080,
          display: "flex",
          justifyContent: "center",
          gap: 28,
          alignItems: "center",
          opacity: at(frame, 34, 48),
        }}
      >
        <ActionButton icon={Eye} size={92} light={light} />
        <ActionButton icon={Heart} size={92} tone="like" filled light={light} />
        <ActionButton icon={Send} size={92} tone="accent" light={light} />
        <PrimaryButton icon={Upload}>опубликовать</PrimaryButton>
      </div>

      <div style={{ position: "absolute", left: 96, top: 520, width: 888 }}>
        <ChipFlow
          levels={TOOLS}
          starts={[50, 74, 104]}
          light={light}
          rowHeight={196}
        />
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          top: 1212,
          width: 1080,
          textAlign: "center",
          ...typo.caption,
          color: c.textMuted,
          opacity: at(frame, 130, 146),
        }}
      >
        предметы разговора
      </div>
      <div
        style={{
          position: "absolute",
          left: 96,
          top: 1272,
          width: 888,
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 34,
        }}
      >
        {SHOWCASE.map((name, i) => (
          <div key={name} style={{ ...css(enter(frame, 140 + i * 5, 14)) }}>
            <Emoji name={name} size={96} />
          </div>
        ))}
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          top: 1560,
          width: 1080,
          display: "flex",
          justifyContent: "center",
          opacity: at(frame, 186, 202),
        }}
      >
        <ChipCard
          label="плашка с подписью"
          origin="pinterest.com — откуда взято"
          emoji="clapper_board"
          light={light}
          from={186}
        />
      </div>
    </AbsoluteFill>
  );
};
