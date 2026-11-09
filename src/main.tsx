import { render } from 'preact'
import './index.css'
import { App } from './app.tsx'
import { PlayerScreen } from './components/PlayerScreen.tsx'

const players = new URLSearchParams(location.search).get('ecran') === 'joueurs'
render(players ? <PlayerScreen /> : <App />, document.getElementById('app')!)
