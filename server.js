const express = require('express');
const cors = require('cors');
const youtubedl = require('youtube-dl-exec');
const path = require('path');

const app = express();
// Hostinq mühitində dinamik portu dinləyirik
const PORT = process.env.PORT || 3000;

// Middleware (Təhlükəsizlik və data oxuma)
app.use(cors());
app.use(express.json());

// Frontend faylımızı (index.html) əsas səhifədə göstəririk
app.use(express.static(path.join(__dirname)));

/**
 * 1. API: Videonun məlumatlarını çəkmək (Analiz)
 */
app.post('/api/info', async (req, res) => {
    const { url } = req.body;
    
    if (!url) return res.status(400).json({ error: "Link daxil edilməyib!" });

    try {
        const info = await youtubedl(url, {
            dumpSingleJson: true,
            noWarnings: true,
            noCallHome: true,
            noCheckCertificate: true,
        });

        // Saniyəni dəqiqə:saniyə formatına salırıq
        const durationStr = info.duration_string || `${Math.floor(info.duration / 60)}:${(info.duration % 60).toString().padStart(2, '0')}`;

        res.json({
            title: info.title || 'Naməlum Media',
            thumbnail: info.thumbnail,
            duration: durationStr,
            extractor: (info.extractor_key || 'Naməlum Sayt').toUpperCase()
        });
    } catch (error) {
        console.error("Məlumat tapılmadı:", error.message);
        res.status(500).json({ error: "Bu linkdən məlumat oxumaq mümkün olmadı." });
    }
});

/**
 * 2. API: Medianı serverdən istifadəçiyə yükləmək (Axın / Streaming)
 */
app.get('/api/download', async (req, res) => {
    const { url, format, quality } = req.query;

    if (!url) return res.status(400).send("Link tapılmadı!");

    try {
        // Faylın adı və növünü təyin edirik
        res.header('Content-Disposition', `attachment; filename="NovaLoad_Media.${format}"`);
        
        // yt-dlp üçün arqumentlər
        const args = {
            noCheckCertificate: true,
            noWarnings: true,
            output: '-' // faylı yadda saxlamadan birbaşa brauzerə göndərir (stream)
        };

        if (format === 'mp3') {
            args.extractAudio = true;
            args.audioFormat = 'mp3';
            args.audioQuality = quality === '320' ? 0 : (quality === '192' ? 5 : 9); // 0=Ən yaxşı
        } else {
            // Video formatı (Seçilən keyfiyyətə və ya ondan kiçik ən yaxşı versiyaya uyğun)
            args.format = `bestvideo[height<=${quality}]+bestaudio/best[height<=${quality}]/best`;
            args.mergeOutputFormat = 'mp4';
        }

        const subprocess = youtubedl.exec(url, args);
        
        // Çıxışı istifadəçiyə axın edirik
        subprocess.stdout.pipe(res);

    } catch (error) {
        console.error("Yükləmə xətası:", error.message);
        res.status(500).send("Yükləmə zamanı xəta baş verdi.");
    }
});

// Serveri işə salırıq
app.listen(PORT, () => {
    console.log(`✅ NovaLoad Serveri işə düşdü! Port: ${PORT}`);
});