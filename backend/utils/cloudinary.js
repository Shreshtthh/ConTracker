import { v2 as cloudinary} from "cloudinary";
import fs from "fs"
import path from "path";

cloudinary.config({ 
    cloud_name: 'dmgf0epcg', 
    api_key: '725434479885863', 
    api_secret: 's8JP2BvpNNPOLDSmY9msW27UDNQ' // Click 'View API Keys' above to copy your API secret
});
   

const UploadOnCloudinary=async function(loacalPathFile){
    console.log("cloudinary objects")
    console.log(loacalPathFile)
    console.log(process.env.CLOUDINARY_CLOUD_NAME)
    console.log(process.env.CLOUDINARY_API_KEY)  
    console.log(process.env.CLOUDINARY_API_SECRET)  
    try{
        if(!loacalPathFile) return null
        const response=await cloudinary.uploader
        .upload(
            loacalPathFile,{
             resource_type:"auto"
            }
        )
        // if (fs.existsSync(loacalPathFile)) {
        //     fs.unlinkSync(loacalPathFile);
        // }
        console.log(response.url)
        console.log("file is uploaded successfully",response.url)
        return response;
    }catch(error){
        console.log("Error uploading file to cloudinary",error)
        // fs.unlinkSync(loacalPathFile)
        return null
    }
}

export {UploadOnCloudinary}

