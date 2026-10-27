import React from 'react';
import {
  BOARD_LINES,
  BOARD_NODES,
  BoardState,
  MoveOption,
  NODE_MAP,
  Player,
  getNodeLabel,
} from '../game/sholoGutiEngine';
import { LanguageCode, TranslationStrings } from '../i18n/translations';

interface SholoGutiBoardProps {
  board: BoardState;
  currentTurn: Player;
  selectedNode: string | null;
  validMoves: MoveOption[];
  lastMove: { from: string; to: string; capturedNodes: string[] } | null;
  hintMove: MoveOption | null;
  chainNode: string | null;
  isAiThinking: boolean;
  showCoordinates: boolean;
  t: TranslationStrings;
  lang: LanguageCode;
  onNodeClick: (nodeId: string) => void;
}

export const SholoGutiBoard: React.FC<SholoGutiBoardProps> = ({
  board,
  currentTurn,
  selectedNode,
  validMoves,
  lastMove,
  hintMove,
  chainNode,
  isAiThinking,
  showCoordinates,
  t,
  lang,
  onNodeClick,
}) => {
  // Map destination nodeId -> MoveOption for quick lookup
  const validTargetMap = React.useMemo(() => {
    const map: Record<string, MoveOption> = {};
    for (const m of validMoves) {
      map[m.to] = m;
    }
    return map;
  }, [validMoves]);

  // Set of opponent pieces currently threatened by the selected piece's capture moves
  const threatenedNodes = React.useMemo(() => {
    const set = new Set<string>();
    for (const m of validMoves) {
      if (m.type === 'capture' && m.capturedNode) {
        set.add(m.capturedNode);
      }
    }
    return set;
  }, [validMoves]);

  return (
    <div className="relative w-full max-w-[500px] mx-auto select-none">
      {/* Natural Light-Brown Wooden Outer Frame (#98643D) with Soft Shadow & Rounded Corners */}
      <div className="relative rounded-3xl p-3 sm:p-4 bg-gradient-to-b from-[#A67148] via-[#98643D] to-[#84532F] shadow-[0_18px_42px_rgba(92,58,33,0.22),0_4px_12px_rgba(92,58,33,0.14)] border-2 border-[#7A4B28]">
        {/* Subtle Traditional Bengali Corner & Frame Filigree */}
        <div className="relative rounded-2xl p-1 bg-gradient-to-b from-[#B8845A]/45 to-[#7A4B28]/45 border border-[#DFC39D]/55">
          {/* Light Cream & Ivory Playfield Container (#F5E8CF) */}
          <div className="relative rounded-xl overflow-hidden bg-[#F5E8CF] border border-[#C6A279] shadow-[inset_0_2px_10px_rgba(145,107,67,0.18)]">
            <svg
              viewBox="0 0 600 840"
              className="w-full h-auto block touch-manipulation"
              role="img"
              aria-label={t.boardAriaLabel}
            >
              <defs>
                {/* Light Cream & Ivory Surface with Subtle Warm Paper Depth (#F5E8CF) */}
                <radialGradient id="ivoryBoardSurface" cx="50%" cy="50%" r="65%">
                  <stop offset="0%" stopColor="#FAF1DF" />
                  <stop offset="65%" stopColor="#F5E8CF" />
                  <stop offset="100%" stopColor="#ECD9B8" />
                </radialGradient>

                {/* Subtle Parchment / Paper Grain Pattern */}
                <pattern
                  id="paperFiberPattern"
                  width="40"
                  height="40"
                  patternUnits="userSpaceOnUse"
                >
                  <path
                    d="M0 10 Q20 8 40 11 M0 28 Q20 30 40 27"
                    fill="none"
                    stroke="#D8C29D"
                    strokeWidth="0.6"
                    opacity="0.4"
                  />
                  <circle cx="12" cy="18" r="0.6" fill="#C9AE84" opacity="0.35" />
                  <circle cx="31" cy="7" r="0.5" fill="#C9AE84" opacity="0.3" />
                  <circle cx="24" cy="33" r="0.6" fill="#C9AE84" opacity="0.3" />
                </pattern>

                {/* Player 1 Piece: Glossy Emerald-Green (#168653) */}
                <radialGradient id="p1EmeraldGrad" cx="34%" cy="28%" r="68%">
                  <stop offset="0%" stopColor="#5CE0A2" />
                  <stop offset="26%" stopColor="#1FA368" />
                  <stop offset="68%" stopColor="#168653" />
                  <stop offset="100%" stopColor="#0D5936" />
                </radialGradient>

                {/* Player 2 Piece: Rich Deep Red (#C93636) */}
                <radialGradient id="p2RedGrad" cx="34%" cy="28%" r="68%">
                  <stop offset="0%" stopColor="#F98F8F" />
                  <stop offset="26%" stopColor="#DE4848" />
                  <stop offset="68%" stopColor="#C93636" />
                  <stop offset="100%" stopColor="#8A1E1E" />
                </radialGradient>

                {/* Soft 3D Piece Drop Shadow on Cream Surface */}
                <filter id="pieceSoftShadow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow
                    dx="0"
                    dy="3.5"
                    stdDeviation="3"
                    floodColor="#4A3219"
                    floodOpacity="0.36"
                  />
                </filter>

                {/* Golden Highlight Glow for Selected Piece */}
                <filter id="selectedGoldHalo" x="-45%" y="-45%" width="190%" height="190%">
                  <feDropShadow
                    dx="0"
                    dy="0"
                    stdDeviation="4.5"
                    floodColor="#D99B26"
                    floodOpacity="0.65"
                  />
                </filter>
              </defs>

              {/* Base Ivory & Cream Surface (#F5E8CF) */}
              <rect x="0" y="0" width="600" height="840" fill="url(#ivoryBoardSurface)" />
              <rect x="0" y="0" width="600" height="840" fill="url(#paperFiberPattern)" />

              {/* Delicate Traditional Bengali Border & Corner Motifs (Subtle & Elegant) */}
              <rect
                x="16"
                y="16"
                width="568"
                height="808"
                rx="12"
                fill="none"
                stroke="#916B43"
                strokeWidth="1.4"
                strokeOpacity="0.38"
              />
              <rect
                x="23"
                y="23"
                width="554"
                height="794"
                rx="9"
                fill="none"
                stroke="#916B43"
                strokeWidth="0.8"
                strokeDasharray="5 4"
                strokeOpacity="0.3"
              />

              {/* 4 Corner Traditional Bengali Lotus/Alpana Accents */}
              {[
                { x: 34, y: 34, rot: 0 },
                { x: 566, y: 34, rot: 90 },
                { x: 566, y: 806, rot: 180 },
                { x: 34, y: 806, rot: 270 },
              ].map((corner, i) => (
                <g
                  key={i}
                  transform={`translate(${corner.x}, ${corner.y}) rotate(${corner.rot})`}
                  stroke="#916B43"
                  strokeWidth="1.2"
                  fill="none"
                  opacity="0.42"
                >
                  <path d="M0,22 C0,8 8,0 22,0" />
                  <path d="M4,26 C4,12 12,4 26,4" />
                  <circle cx="9" cy="9" r="2.2" fill="#916B43" />
                </g>
              ))}

              {/* Subtle Traditional Bengali Alpana Medallion at Center (300, 420) */}
              <g transform="translate(300, 420)" opacity="0.22" stroke="#916B43" fill="none">
                <circle r="44" strokeWidth="1.2" strokeDasharray="3 3" />
                <circle r="31" strokeWidth="1" />
                <path
                  d="M0,-36 C6,-12 12,-6 36,0 C12,6 6,12 0,36 C-6,12 -12,6 -36,0 C-12,-6 -6,-12 0,-36 Z"
                  strokeWidth="1.1"
                />
              </g>

              {/* Very Gentle Camp Tint to Distinguish Top & Bottom Triangles */}
              <polygon
                points="140,60 460,60 300,220"
                fill="#C93636"
                fillOpacity="0.045"
              />
              <polygon
                points="140,780 460,780 300,620"
                fill="#168653"
                fillOpacity="0.045"
              />

              {/* All 20 Straight Board Lines in Clean Crisp Brown (#916B43) */}
              <g strokeLinecap="round" strokeLinejoin="round">
                {BOARD_LINES.map((line, idx) => {
                  const firstNode = NODE_MAP[line[0]];
                  const lastNode = NODE_MAP[line[line.length - 1]];
                  const isCenterMiddleRow =
                    line[0] === 'r4_c0' && line[line.length - 1] === 'r4_c4';
                  return (
                    <g key={idx}>
                      {/* Subtle Soft Line Highlight Underneath */}
                      <line
                        x1={firstNode.x}
                        y1={firstNode.y + 1.2}
                        x2={lastNode.x}
                        y2={lastNode.y + 1.2}
                        stroke="#FFF9EE"
                        strokeWidth={isCenterMiddleRow ? 4.5 : 3.8}
                        opacity="0.7"
                      />
                      {/* Primary Clean Brown Connection Line (#916B43) */}
                      <line
                        x1={firstNode.x}
                        y1={firstNode.y}
                        x2={lastNode.x}
                        y2={lastNode.y}
                        stroke="#916B43"
                        strokeWidth={isCenterMiddleRow ? 3.4 : 2.8}
                        opacity="0.95"
                      />
                    </g>
                  );
                })}
              </g>

              {/* Last Move Trail Indicator */}
              {lastMove && NODE_MAP[lastMove.from] && NODE_MAP[lastMove.to] && (
                <g>
                  <line
                    x1={NODE_MAP[lastMove.from].x}
                    y1={NODE_MAP[lastMove.from].y}
                    x2={NODE_MAP[lastMove.to].x}
                    y2={NODE_MAP[lastMove.to].y}
                    stroke="#C88A20"
                    strokeWidth="3.5"
                    strokeDasharray="7 5"
                    strokeLinecap="round"
                    opacity="0.8"
                  />
                  <circle
                    cx={NODE_MAP[lastMove.from].x}
                    cy={NODE_MAP[lastMove.from].y}
                    r="8"
                    fill="#F5E8CF"
                    stroke="#C88A20"
                    strokeWidth="2.2"
                    opacity="0.85"
                  />
                </g>
              )}

              {/* Hint Move Indicator */}
              {hintMove && NODE_MAP[hintMove.from] && NODE_MAP[hintMove.to] && (
                <g>
                  <line
                    x1={NODE_MAP[hintMove.from].x}
                    y1={NODE_MAP[hintMove.from].y}
                    x2={NODE_MAP[hintMove.to].x}
                    y2={NODE_MAP[hintMove.to].y}
                    stroke="#168653"
                    strokeWidth="4.5"
                    strokeDasharray="8 4"
                    strokeLinecap="round"
                  />
                  <circle
                    cx={NODE_MAP[hintMove.from].x}
                    cy={NODE_MAP[hintMove.from].y}
                    r="29"
                    fill="none"
                    stroke="#168653"
                    strokeWidth="2.8"
                    strokeDasharray="5 3"
                  />
                  <circle
                    cx={NODE_MAP[hintMove.to].x}
                    cy={NODE_MAP[hintMove.to].y}
                    r="22"
                    fill="#168653"
                    fillOpacity="0.18"
                    stroke="#168653"
                    strokeWidth="2.2"
                  />
                </g>
              )}

              {/* All 37 Board Intersection Points & Pieces */}
              {BOARD_NODES.map((node) => {
                const occupant = board[node.id];
                const isSelected = selectedNode === node.id;
                const moveOption = validTargetMap[node.id];
                const isValidTarget = Boolean(moveOption);
                const isCaptureTarget = moveOption?.type === 'capture';
                const isThreatened = threatenedNodes.has(node.id);
                const isLastMoveDest = lastMove?.to === node.id;
                const isMajorHub =
                  node.id === 'r4_c2' || node.id === 'r2_c2' || node.id === 'r6_c2';

                const canSelectPiece =
                  !isAiThinking &&
                  occupant === currentTurn &&
                  (chainNode === null || chainNode === node.id);

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    onClick={() => onNodeClick(node.id)}
                    className={
                      canSelectPiece || isValidTarget
                        ? 'cursor-pointer'
                        : 'cursor-default'
                    }
                  >
                    {/* Generous Touch Target (56x56 SVG units) */}
                    <circle r="28" fill="transparent" />

                    {/* Clean Brown Intersection Ring & Dot (#916B43) */}
                    <circle
                      r={isMajorHub ? 9.5 : 7}
                      fill="#F5E8CF"
                      stroke="#916B43"
                      strokeWidth={isMajorHub ? 2.4 : 2}
                    />
                    <circle r={isMajorHub ? 3.8 : 3} fill="#916B43" />

                    {/* Valid Move Destination: Soft Golden Indicator */}
                    {isValidTarget && (
                      <g>
                        <circle
                          r="22"
                          fill={isCaptureTarget ? '#F59E0B' : '#EAB308'}
                          fillOpacity={isCaptureTarget ? '0.28' : '0.22'}
                          stroke={isCaptureTarget ? '#B45309' : '#CA8A04'}
                          strokeWidth="2.5"
                          strokeDasharray={isCaptureTarget ? '5 3' : undefined}
                        />
                        <circle
                          r={isCaptureTarget ? 9.5 : 7.5}
                          fill={isCaptureTarget ? '#D97706' : '#EAB308'}
                          stroke="#FFFBEB"
                          strokeWidth="1.8"
                        />
                        {isCaptureTarget && (
                          <text
                            y="-26"
                            textAnchor="middle"
                            fill="#9A3412"
                            fontSize="12"
                            fontWeight="700"
                            className="pointer-events-none"
                          >
                            {t.captureJumpBadge}
                          </text>
                        )}
                      </g>
                    )}

                    {/* Playing Piece */}
                    {occupant !== null && (
                      <g
                        transform={isSelected ? 'scale(1.13)' : 'scale(1)'}
                        style={{
                          transition: 'transform 160ms cubic-bezier(0.16, 1, 0.3, 1)',
                        }}
                      >
                        {/* Subtle Ring on Last Moved Piece */}
                        {isLastMoveDest && !isSelected && (
                          <circle
                            r="25.5"
                            fill="none"
                            stroke="#C88A20"
                            strokeWidth="2"
                            strokeOpacity="0.75"
                          />
                        )}

                        {/* Selected Piece Golden Highlight Halo */}
                        {isSelected && (
                          <g>
                            <circle
                              r="27.5"
                              fill="#F59E0B"
                              fillOpacity="0.28"
                              stroke="#D99B26"
                              strokeWidth="3.2"
                              filter="url(#selectedGoldHalo)"
                            />
                            <circle
                              r="24.5"
                              fill="none"
                              stroke="#FEF08A"
                              strokeWidth="1.8"
                            />
                          </g>
                        )}

                        {/* Threatened Opponent Piece Indicator (When Jump Capture is Available) */}
                        {isThreatened && (
                          <circle
                            r="26.5"
                            fill="#D97706"
                            fillOpacity="0.22"
                            stroke="#B45309"
                            strokeWidth="2.5"
                            strokeDasharray="4 3"
                          />
                        )}

                        {/* 3D Piece Disc: Player 1 = Emerald Green (#168653), Player 2 = Deep Red (#C93636) */}
                        <circle
                          r="21"
                          fill={
                            occupant === 1
                              ? 'url(#p1EmeraldGrad)'
                              : 'url(#p2RedGrad)'
                          }
                          stroke={
                            isSelected
                              ? '#FDE047'
                              : occupant === 1
                              ? '#0B4F30'
                              : '#7A1A1A'
                          }
                          strokeWidth={isSelected ? 3 : 2}
                          filter="url(#pieceSoftShadow)"
                        />

                        {/* Inner Rim Ring for 3D Turned Effect */}
                        <circle
                          r="15.2"
                          fill="none"
                          stroke={occupant === 1 ? '#A7F3D0' : '#FECACA'}
                          strokeWidth="1.1"
                          strokeOpacity="0.65"
                        />

                        {/* Subtle Traditional Motif in the Center of Each Piece */}
                        {occupant === 1 ? (
                          /* Player 1 (Emerald Green): Traditional 8-Pointed Bengali Lotus/Sun Motif */
                          <g
                            stroke="#ECFDF5"
                            strokeWidth="1.35"
                            fill="none"
                            opacity="0.88"
                          >
                            <circle r="7.5" strokeOpacity="0.55" />
                            <path
                              d="M0,-10 L2.5,-2.5 L10,0 L2.5,2.5 L0,10 L-2.5,2.5 L-10,0 L-2.5,-2.5 Z"
                              fill="#ECFDF5"
                              fillOpacity="0.25"
                            />
                            <circle r="2.6" fill="#ECFDF5" />
                          </g>
                        ) : (
                          /* Player 2 (Deep Red): Traditional Bengali Nakshi Diamond Florals */
                          <g
                            stroke="#FFF1F2"
                            strokeWidth="1.35"
                            fill="none"
                            opacity="0.88"
                          >
                            <circle r="7.5" strokeOpacity="0.55" />
                            <polygon
                              points="0,-9.5 9.5,0 0,9.5 -9.5,0"
                              fill="#FFF1F2"
                              fillOpacity="0.22"
                            />
                            <circle r="2.8" fill="#FFF1F2" />
                          </g>
                        )}

                        {/* Glossy 3D Specular Highlight */}
                        <ellipse
                          cx="-6.5"
                          cy="-7.5"
                          rx="6.2"
                          ry="3"
                          transform="rotate(-28 -6.5 -7.5)"
                          fill="#FFFFFF"
                          fillOpacity="0.34"
                        />
                      </g>
                    )}

                    {/* Optional Localized Coordinate Label */}
                    {showCoordinates && (
                      <text
                        y={occupant ? 34 : 21}
                        textAnchor="middle"
                        fill="#5C3A21"
                        fontSize="10.5"
                        fontWeight="700"
                        className="pointer-events-none"
                      >
                        {getNodeLabel(node.id, lang)}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
};
