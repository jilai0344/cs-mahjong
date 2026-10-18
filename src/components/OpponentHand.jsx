import React from 'react';
import MahjongTile from './MahjongTile.jsx';
import StartingHuBadge from './StartingHuBadge.jsx';
import StartingHuHand from './StartingHuHand.jsx';

const WINDS = ['东', '南', '西', '北'];

/**
 * 对手手牌与信息牌。
 * 不复制黄金岛的金框椭圆胶囊，改成一张半透明纸片：头像 + 昵称 + 分数，
 * 轮到时只加一圈很轻的玉色描边，避免整桌发光。
 */
export default function OpponentHand({
  player,
  handCount = 13,
  melds = [],
  isCurrentTurn = false,
  score = 1000,
  isDealer = false,
  visualPosition = null,
  isAi = false,
  aiLabel = '电脑',
  startingHu = null
}) {
  const { name = '' } = player || {};
  const finalPos = visualPosition || player?.position || 'top';
  const isTop = finalPos === 'top';
  const wind = WINDS[(player?.id ?? 0) % 4];
  const dealStyle = finalPos === 'top'
    ? { '--deal-x': '0px', '--deal-y': '240px', '--deal-rx': '-10deg' }
    : finalPos === 'left'
      ? { '--deal-x': '240px', '--deal-y': '0px', '--deal-ry': '-14deg' }
      : { '--deal-x': '-240px', '--deal-y': '0px', '--deal-ry': '14deg' };

  return (
    <div
      className={`z-10 flex select-none items-center ${isTop ? 'flex-col gap-1.5' : 'flex-col items-center gap-1.5'}`}
      style={dealStyle}
    >
      {/* 玩家信息：纸片胶囊 */}
      <div
        className={`glass-pill relative flex shrink-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 transition-[transform,box-shadow] duration-150 ${
          isCurrentTurn ? 'scale-[1.03] ring-2 ring-white/80' : ''
        }`}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-jade-600)] text-[11px] font-bold text-white">
          {wind}
        </span>

        {isDealer && (
          <span
            className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[9px] font-bold text-white"
            title="本局庄家"
          >
            庄
          </span>
        )}

        <span className="max-w-[7rem] truncate text-[12px] font-semibold text-stone-800">
          {name}
        </span>

        <span key={score} className="animate-callout ml-0.5 font-mono text-[11px] tabular-nums text-stone-500">
          {score}
        </span>

        {isAi && (
          <span
            className="rounded-full border border-stone-300 bg-white/80 px-1.5 py-[1px] text-[9px] font-semibold text-stone-500"
            title={aiLabel === '托管' ? '该座位真人掉线，已由电脑接管' : '该座位由电脑补位'}
          >
            {aiLabel}
          </span>
        )}

        {isCurrentTurn && (
          <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-[var(--color-jade-600)]" title="思考中" />
        )}
      </div>

      {startingHu?.hand?.length > 0 ? (
        /* 起手胡：番型条与整列手牌一起朝向胡家；手牌直接替换暗牌 */
        <div
          className={`flex items-center gap-1.5 ${
            isTop ? 'flex-col' : finalPos === 'left' ? 'flex-row-reverse' : 'flex-row'
          }`}
        >
          <StartingHuBadge event={startingHu} facing={finalPos} />
          <StartingHuHand hand={startingHu.hand} facing={finalPos} />
        </div>
      ) : (
        <>
          {startingHu && <StartingHuBadge event={startingHu} facing={finalPos} />}
          <div
            className={`${isTop ? 'opp-top-row' : ''} flex items-center gap-1.5 ${
              isTop ? 'flex-row' : 'flex-col justify-center'
            }`}
          >
            {melds.length > 0 && (
              <div
                className={`opp-melds-box flex shrink-0 gap-1 rounded-xl border border-white/20 bg-white/10 p-1 ${
                  isTop ? 'flex-row' : 'flex-col items-center justify-center'
                }`}
              >
                {melds.map((meld, mIdx) => (
                  <div
                    key={mIdx}
                    className={`opp-meld-group animate-meld-snap flex rounded-lg border border-white/15 bg-white/10 p-0.5 ${
                      isTop ? 'flex-row items-center gap-0.5' : 'flex-col items-center gap-0.5'
                    }`}
                  >
                    {meld.tiles.map((tile, tIdx) => {
                      const isEatenTile = meld.type === 'chi' && tIdx === 1;

                      if (isTop) {
                        return (
                          <div
                            key={tIdx}
                            className={`opp-tile-wrap relative flex shrink-0 items-center justify-center rounded-sm ${
                              isEatenTile ? 'ring-1 ring-white/80' : ''
                            }`}
                          >
                            <MahjongTile
                              tile={tile}
                              size="discard"
                              isBack={meld.type === 'an_gang'}
                              lying
                              className="ph-tile animate-deal-in"
                            />
                          </div>
                        );
                      }

                      return (
                        <div
                          key={tIdx}
                          className={`relative flex h-[26px] w-[36px] shrink-0 items-center justify-center rounded-sm sm:h-[30px] sm:w-[42px] ${
                            isEatenTile ? 'ring-1 ring-white/80' : ''
                          }`}
                        >
                          <MahjongTile
                            tile={tile}
                            size="discard-side"
                            isBack={meld.type === 'an_gang'}
                            lying
                            className="animate-deal-in"
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}

            <div
              className={`opp-backs flex shrink-0 ${
                isTop ? 'opp-backs-top flex-row gap-0.5' : 'flex-col -space-y-1.5 justify-center sm:-space-y-2'
              }`}
            >
              {[...Array(Math.max(0, handCount))].map((_, idx) => (
                <MahjongTile
                  key={idx}
                  isBack
                  size={isTop ? 'opp-top' : 'opp-side'}
                  className={isTop ? 'ph-tile animate-deal-in' : 'animate-deal-in'}
                  style={{ animationDelay: `${Math.min(idx, 13) * 20}ms` }}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
