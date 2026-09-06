param(
  [Parameter(Mandatory = $true)]
  [string]$FfmpegPath
)

$source = 'art/audio/metal-shutter-original.mp3'
$output = 'public/assets/audio/sfx'

& $FfmpegPath -y -ss 2.00 -t 1.60 -i $source `
  -af 'highpass=f=55,afade=t=in:st=0:d=0.015,afade=t=out:st=1.00:d=0.60,loudnorm=I=-19:TP=-2:LRA=8' `
  -ar 44100 -ac 2 -codec:a pcm_s16le "$output/shutter.wav"

& $FfmpegPath -y -ss 5.58 -t 2.50 -i $source `
  -af 'highpass=f=55,afade=t=in:st=0:d=0.015,afade=t=out:st=1.95:d=0.55,loudnorm=I=-18:TP=-2:LRA=8' `
  -ar 44100 -ac 2 -codec:a pcm_s16le "$output/shutter-close.wav"

$bellSource = 'art/audio/bell-chime-original.mp3'
& $FfmpegPath -y -ss 1.30 -t 1.00 -i $bellSource `
  -af 'highpass=f=90,afade=t=in:st=0:d=0.01,afade=t=out:st=0.70:d=0.30,loudnorm=I=-21:TP=-3:LRA=7' `
  -ar 44100 -ac 2 -codec:a pcm_s16le "$output/customer-bell.wav"

$geigerSource = 'art/audio/geiger-counter-low-original.mp3'
& $FfmpegPath -y -ss 0.43 -t 0.13 -i $geigerSource `
  -af 'highpass=f=180,afade=t=in:st=0:d=0.003,afade=t=out:st=0.09:d=0.04,loudnorm=I=-20:TP=-4:LRA=5' `
  -ar 44100 -ac 1 -codec:a pcm_s16le "$output/statement-line-click.wav"

$paperSource = 'art/audio/paper-flutter-original.mp3'
& $FfmpegPath -y -ss 0 -t 2.10 -i $paperSource `
  -af 'highpass=f=100,afade=t=in:st=0:d=0.015,afade=t=out:st=1.60:d=0.50,loudnorm=I=-22:TP=-4:LRA=6' `
  -ar 44100 -ac 2 -codec:a pcm_s16le "$output/statement-paper.wav"

$typingSource = 'art/audio/mechanical-keyboard-original.mp3'
& $FfmpegPath -y -ss 0.25 -t 1.50 -i $typingSource `
  -af 'atempo=1.75,highpass=f=180,afade=t=in:st=0:d=0.008,afade=t=out:st=0.81:d=0.045,loudnorm=I=-26:TP=-6:LRA=5' `
  -ar 44100 -ac 1 -codec:a pcm_s16le "$output/customer-typing.wav"

$buttonClickSource = 'art/audio/button-click-vintage-original.mp3'
& $FfmpegPath -y -ss 0.020 -t 0.205 -i $buttonClickSource `
  -af 'highpass=f=80,afade=t=in:st=0:d=0.003,afade=t=out:st=0.185:d=0.020,loudnorm=I=-23:TP=-5:LRA=4' `
  -ar 44100 -ac 1 -codec:a pcm_s16le "$output/ui-click.wav"

$cashRegisterSource = 'art/audio/cash-register-purchase-original.mp3'
& $FfmpegPath -y -ss 0.10 -t 1.55 -i $cashRegisterSource `
  -af 'highpass=f=65,afade=t=in:st=0:d=0.01,afade=t=out:st=1.20:d=0.35,loudnorm=I=-20:TP=-3:LRA=7' `
  -ar 44100 -ac 2 -codec:a pcm_s16le "$output/cash-register.wav"

$cameraShutterSource = 'art/audio/camera-shutter-original.mp3'
& $FfmpegPath -y -ss 0.62 -t 0.22 -i $cameraShutterSource `
  -af 'highpass=f=100,afade=t=in:st=0:d=0.004,afade=t=out:st=0.17:d=0.05,loudnorm=I=-22:TP=-4:LRA=5' `
  -ar 44100 -ac 1 -codec:a pcm_s16le "$output/day-number-swap.wav"

$shopDoorBellSource = 'art/audio/shop-door-bell-original.mp3'
& $FfmpegPath -y -ss 0.30 -t 1.25 -i $shopDoorBellSource `
  -af 'highpass=f=100,afade=t=in:st=0:d=0.01,afade=t=out:st=0.95:d=0.30,loudnorm=I=-22:TP=-4:LRA=6' `
  -ar 44100 -ac 1 -codec:a pcm_s16le "$output/shop-window-bell.wav"
