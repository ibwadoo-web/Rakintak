import { Client, Databases, Query } from 'node-appwrite';

// ---------------------------------------------
// LA FORMULE MAGIQUE (Ne pas modifier)
// C'est la formule mathématique pour calculer la distance entre 2 points GPS
// ---------------------------------------------
function calculerDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Rayon de la Terre en km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Renvoie la distance en kilomètres
}

// ---------------------------------------------
// LE TRAVAIL DU ROBOT
// ---------------------------------------------
export default async ({ req, res, log, error }) => {
    try {
        // 1. Le Robot récupère la position du client envoyée par l'application
        const donneesRecues = JSON.parse(req.body);
        const clientLat = donneesRecues.customerLat;
        const clientLng = donneesRecues.customerLng;
        const rayonRecherche = donneesRecues.radiusKm || 5; // Par défaut, on cherche dans un rayon de 5 km

        // 2. Le Robot se connecte à la base de données Appwrite
        const client = new Client()
            .setEndpoint('https://cloud.appwrite.io/v1')
            .setProject(process.env.APPWRITE_PROJECT_ID) // On utilisera l'ID de votre projet
            .setKey(process.env.APPWRITE_API_KEY);       // Clé secrète pour avoir le droit de lire

        const databases = new Databases(client);

        // 3. Le Robot demande la liste de TOUS les livreurs disponibles et vérifiés
        const listeLivreurs = await databases.listDocuments(
            'rakintak_db', // L'ID de votre base de données
            'drivers',     // L'ID de votre collection "livreurs"
            [Query.equal('is_available', true), Query.equal('is_verified', true)]
        );

        const livreursProches = [];

        // 4. Pour chaque livreur dans la liste, on calcule sa distance avec le client
        for (const livreur of listeLivreurs.documents) {
            if (livreur.latitude && livreur.longitude) {
                const distance = calculerDistance(clientLat, clientLng, livreur.latitude, livreur.longitude);
                
                // 5. Si le livreur est assez proche (ex: moins de 5 km), on le garde !
                if (distance <= rayonRecherche) {
                    livreursProches.push({
                        id: livreur.$id,
                        nom: livreur.full_name,
                        vehicule: livreur.vehicle_type,
                        note: livreur.rating,
                        distance: Math.round(distance * 10) / 10, // Arrondi à 1 chiffre après la virgule (ex: 2.3 km)
                        lat: livreur.latitude,
                        lng: livreur.longitude
                    });
                }
            }
        }

        // 6. On trie la liste du plus proche au plus loin
        livreursProches.sort((a, b) => a.distance - b.distance);

        // 7. Le Robot renvoie la liste finale à l'application Flutter
        return res.json({
            success: true,
            livreurs: livreursProches
        });

    } catch (erreur) {
        // En cas de problème, le Robot affiche l'erreur
        return res.json({ success: false, message: "Erreur serveur" }, 500);
    }
};
