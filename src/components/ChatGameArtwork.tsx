type Props = { game: string; title: string }

export default function GameArtwork({ game, title }: Props) {
  return <svg className="game-preview-art" viewBox="0 0 360 196" role="img" aria-label={`${title} game illustration`}>
    <rect width="360" height="196" fill="#1b1b1b" />
    {game === 'chess' && <>
      {Array.from({ length: 64 }, (_, i) => <rect key={i} x={84 + i % 8 * 24} y={2 + Math.floor(i / 8) * 24} width="24" height="24" fill={(i + Math.floor(i / 8)) % 2 ? '#30302d' : '#aaa590'} />)}
      {['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'].map((piece, i) => <text key={i} x={96 + i * 24} y="25" fontSize="26" textAnchor="middle" fill="#141414">{piece}</text>)}
      {[0, 1, 2, 3, 5, 6, 7].map(i => <text key={i} x={96 + i * 24} y="49" fontSize="24" textAnchor="middle" fill="#141414">♟</text>)}
      {[0, 1, 2, 3, 5, 6, 7].map(i => <text key={i} x={96 + i * 24} y="168" fontSize="24" textAnchor="middle" fill="#f7f1dc" stroke="#555" strokeWidth=".3">♟</text>)}
      <text x="192" y="97" fontSize="24" textAnchor="middle" fill="#f7f1dc">♟</text>
      <text x="192" y="73" fontSize="24" textAnchor="middle" fill="#141414">♟</text>
      {['♜', '♞', '♝', '♛', '♚', '♝', '♞', '♜'].map((piece, i) => <text key={i} x={96 + i * 24} y="191" fontSize="26" textAnchor="middle" fill="#f7f1dc" stroke="#555" strokeWidth=".3">{piece}</text>)}
    </>}
    {game === 'connect4' && <>
      <rect x="65" y="10" width="230" height="178" rx="5" fill="#252b35" stroke="#434b58" />
      {Array.from({ length: 42 }, (_, i) => <circle key={i} cx={86 + i % 7 * 31} cy={29 + Math.floor(i / 7) * 28} r="10" fill={i >= 35 ? i % 2 ? '#e0bc43' : '#b5554b' : [23, 29, 30, 31, 32].includes(i) ? i % 2 ? '#b5554b' : '#e0bc43' : '#111315'} />)}
    </>}
    {game === 'tictactoe' && <g strokeLinecap="round" fill="none">
      <path d="M151 27v142m58-142v142M94 74h172M94 122h172" stroke="#555" strokeWidth="2" />
      <path d="m111 37 25 25m0-25-25 25m114 64 25 25m0-25-25 25M167.5 85.5l25 25m0-25-25 25" stroke="#e0bc43" strokeWidth="5" />
      <circle cx="236" cy="49" r="15" stroke="#bbb" strokeWidth="5" /><circle cx="122" cy="146" r="15" stroke="#bbb" strokeWidth="5" />
    </g>}
    {game === 'wordle' && <>
      {['CRANE', 'SPOIL', 'GHOST', '     '].map((word, row) => [...word].map((letter, col) => <g key={`${row}-${col}`}>
        <rect x={76 + col * 43} y={13 + row * 43} width="37" height="37" rx="2" fill={row === 3 ? '#202020' : row === 2 || col === 3 && row === 1 ? '#506e49' : col === 2 || col === 4 && row === 1 ? '#a18a3a' : '#393939'} stroke={row === 3 ? '#444' : 'none'} />
        <text x={94.5 + col * 43} y={39 + row * 43} textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="22" fill="#eee">{letter}</text>
      </g>))}
    </>}
    {game === 'battleships' && <>
      {Array.from({ length: 80 }, (_, i) => <rect key={i} x={70 + i % 10 * 22} y={10 + Math.floor(i / 10) * 22} width="22" height="22" fill="#1d282d" stroke="#3b4a50" strokeWidth=".6" />)}
      <rect x="94" y="56" width="84" height="18" rx="7" fill="#626e72" /><rect x="224" y="100" width="18" height="62" rx="7" fill="#626e72" />
      {[12, 36, 44, 59, 67].map(i => <circle key={i} cx={81 + i % 10 * 22} cy={21 + Math.floor(i / 10) * 22} r="3" fill="#a0b6c0" />)}
      {[21, 22, 23].map(i => <path key={i} d={`m${77 + i % 10 * 22} ${17 + Math.floor(i / 10) * 22} 8 8m0-8-8 8`} stroke="#d0785b" strokeWidth="2" />)}
    </>}
    {game === 'uno' && <>
      {['#ad4d40', '#bd9b38', '#477553', '#44678c'].map((color, i) => <g key={color} transform={`translate(${92 + i * 38} 30) rotate(${(i - 1.5) * 9} 38 65)`}>
        <rect width="77" height="130" rx="8" fill={color} stroke="#ddd7c5" strokeWidth="4" />
        <ellipse cx="38" cy="65" rx="25" ry="46" transform="rotate(20 38 65)" fill="#eee7d7" />
        <text x="38" y="81" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="800" fontSize="40" fill={color}>{[7, 2, '+2', 4][i]}</text>
        <text x="10" y="22" fontFamily="Arial, sans-serif" fontSize="14" fontWeight="700" fill="#fff">{[7, 2, '+2', 4][i]}</text>
      </g>)}
    </>}
    {game === 'gartic' && <g strokeLinecap="round" strokeLinejoin="round">
      <rect x="72" y="27" width="216" height="140" fill="#252525" stroke="#555" />
      <path d="m101 139 43-50 34 33 24-18 40 35M211 66a12 12 0 1 0 0 .1" fill="none" stroke="#c3bb96" strokeWidth="3" />
      <path d="m244 115 40-40 9 9-40 40-15 6Z" fill="#e0bc43" stroke="#151515" strokeWidth="2" />
      <path d="M105 175h130m-16 0-8-7m8 7-8 7" fill="none" stroke="#777" strokeWidth="2" />
    </g>}
  </svg>
}
